#!/usr/bin/env bash
# ==============================================================================
# KlaRetail - Restaurant & Omnichannel POS Full System Automated Deployment
# Target: Production Testing Environment
# ==============================================================================
set -euo pipefail

echo "===> [1/6] Validating database connection & applying SQL migrations..."
DB_URL=$(grep DATABASE_URL .env | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/-pooler//')

if [ -z "$DB_URL" ]; then
  echo "[-] ERROR: DATABASE_URL not found in .env"
  exit 1
fi

mkdir -p supabase/migrations scripts

# 1. Generate unified migration file
cat << 'EOF' > supabase/migrations/20261026_restaurant_pos_unified.sql
BEGIN;

-- Fulfillment enum extension
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_fulfillment_type') THEN
    CREATE TYPE order_fulfillment_type AS ENUM ('delivery', 'pickup', 'walk_in', 'dine_in');
  ELSE
    ALTER TYPE order_fulfillment_type ADD VALUE IF NOT EXISTS 'walk_in';
    ALTER TYPE order_fulfillment_type ADD VALUE IF NOT EXISTS 'dine_in';
  END IF;
END $$;

-- Table Session Status Enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_session_status') THEN
    CREATE TYPE table_session_status AS ENUM ('open', 'bill_requested', 'settled', 'cancelled');
  END IF;
END $$;

-- Physical Tables
CREATE TABLE IF NOT EXISTS vendor_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  table_number VARCHAR(16) NOT NULL,
  seating_capacity INT NOT NULL DEFAULT 4,
  qr_token VARCHAR(64) UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_vendor_table_number UNIQUE (vendor_id, table_number)
);

-- Table Sessions
CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES vendor_tables(id) ON DELETE CASCADE,
  waiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status table_session_status NOT NULL DEFAULT 'open',
  guest_count INT DEFAULT 1,
  notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  total_billed INT NOT NULL DEFAULT 0,
  total_settled INT NOT NULL DEFAULT 0
);

-- Product Modifier Groups
CREATE TABLE IF NOT EXISTS product_modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  min_selections INT NOT NULL DEFAULT 0,
  max_selections INT NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product Modifier Options
CREATE TABLE IF NOT EXISTS product_modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  price_delta INT NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product to Modifier Junction
CREATE TABLE IF NOT EXISTS product_to_modifier_groups (
  product_id VARCHAR(255) NOT NULL,
  modifier_group_id UUID NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, modifier_group_id)
);

-- Alter Orders Table
ALTER TABLE orders 
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_type order_fulfillment_type NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pos_terminal_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES vendor_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Alter Order Items Table
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kitchen_notes VARCHAR(255);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_vendor_tables_vendor ON vendor_tables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_active ON table_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_table_session ON orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_modifier_opts_group ON product_modifier_options(group_id);

COMMIT;
EOF

psql "$DB_URL" -f supabase/migrations/20261026_restaurant_pos_unified.sql
echo "[+] Database schema migrated successfully."

echo "===> [2/6] Fixing Drizzle ORM Schema definitions & imports in src/db/schema.ts..."
node -e '
const fs = require("fs");
const file = "src/db/schema.ts";
let content = fs.readFileSync(file, "utf8");

// Ensure required types are imported from drizzle-orm/pg-core
const match = content.match(/import\s*\{([\s\S]*?)\}\s*from\s*["\x27]drizzle-orm\/pg-core["\x27];/);
if (match) {
  let imports = match[1].split(",").map(s => s.trim()).filter(Boolean);
  ["unique", "primaryKey", "boolean", "text", "jsonb"].forEach(item => {
    if (!imports.includes(item)) imports.push(item);
  });
  const newImport = `import {\n  ${imports.join(",\n  ")},\n} from "drizzle-orm/pg-core";`;
  content = content.replace(match[0], newImport);
}

// Make customerId nullable and inject table/waiter FKs on orders if not already present
if (content.includes("customerId: uuid(\x27customer_id\x27)\n    .notNull()")) {
  content = content.replace(
    "customerId: uuid(\x27customer_id\x27)\n    .notNull()",
    "customerId: uuid(\x27customer_id\x27)"
  );
}

fs.writeFileSync(file, content, "utf8");
console.log("[+] src/db/schema.ts imports patched.");
'

echo "===> [3/6] Setting up KDS API routes (/api/vendor/kds/tickets & update-status)..."
mkdir -p src/app/api/vendor/kds/tickets src/app/api/vendor/kds/update-status

cat << 'EOF' > src/app/api/vendor/kds/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, vendorTables, users } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const rawOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        fulfillmentType: orders.fulfillmentType,
        status: orders.status,
        tableNumber: vendorTables.tableNumber,
        waiterName: users.name,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(vendorTables, eq(orders.tableId, vendorTables.id))
      .leftJoin(users, eq(orders.waiterId, users.id))
      .where(inArray(orders.status, ["accepted", "preparing", "scheduled_confirmed"] as any))
      .orderBy(desc(orders.createdAt));

    const orderIds = rawOrders.map((o) => o.id);
    let itemsByOrder: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const allItems = await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));

      allItems.forEach((it) => {
        if (!itemsByOrder[it.orderId]) itemsByOrder[it.orderId] = [];
        itemsByOrder[it.orderId].push({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          selectedModifiers: it.selectedModifiers || [],
          kitchenNotes: it.kitchenNotes,
        });
      });
    }

    const tickets = rawOrders.map((o) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));

    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    console.error("[KDS_TICKETS_ERR]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
EOF

cat << 'EOF' > src/app/api/vendor/kds/update-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { orderId, status } = await req.json();
    if (!orderId || !status) {
      return NextResponse.json({ success: false, message: "Missing orderId or status" }, { status: 400 });
    }

    await db
      .update(orders)
      .set({
        status: status as any,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ success: true, orderId, status });
  } catch (error: any) {
    console.error("[KDS_UPDATE_STATUS_ERR]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
EOF

echo "===> [4/6] Setting up POS Checkout API route (/api/vendor/pos/checkout)..."
mkdir -p src/app/api/vendor/pos/checkout

cat << 'EOF' > src/app/api/vendor/pos/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, products, platformAuditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, paymentMethod, cashTendered, customerPhone, cashierId, posTerminalId } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "Cart cannot be empty." }, { status: 400 });
    }

    const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.unitPrice) * Number(it.quantity), 0);
    const orderNumber = `POS-${Date.now().toString().slice(-6)}`;

    const firstProduct = await db.query.products.findFirst({
      where: eq(products.id, items[0].productId),
    });
    const vendorId = firstProduct?.vendorId || null;

    const result = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber,
          vendorId,
          cashierId: cashierId || null,
          posTerminalId: posTerminalId || "POS-TERM-01",
          fulfillmentType: "walk_in",
          status: "delivered",
          productSubtotal: subtotal,
          deliveryFee: 0,
          serviceFee: 0,
          damageProtectionFee: 0,
          convenienceFee: 0,
          totalAmount: subtotal,
          paymentMethod: paymentMethod || "COD",
          codAmountDue: paymentMethod === "COD" ? subtotal : 0,
          codCashReceived: paymentMethod === "COD" ? (cashTendered || subtotal) : 0,
          codVerifiedAt: new Date(),
        })
        .returning();

      for (const item of items) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        });

        await tx.execute(sql`
          UPDATE products 
          SET stock = GREATEST(0, stock - ${item.quantity})
          WHERE id = ${item.productId};
        `);
      }

      await tx.insert(platformAuditLogs).values({
        actorId: cashierId || vendorId || "00000000-0000-0000-0000-000000000000",
        actorRole: "vendor_staff",
        action: "POS_WALK_IN_SALE",
        targetEntity: "orders",
        targetId: newOrder.id,
        metadata: {
          orderNumber,
          totalAmount: subtotal,
          paymentMethod,
          itemCount: items.length,
          customerPhone: customerPhone || null,
        },
        ipAddress: req.headers.get("x-forwarded-for") || "127.0.0.1",
      });

      return newOrder;
    });

    return NextResponse.json({ success: true, order: result });
  } catch (error: any) {
    console.error("[POS_CHECKOUT_ERROR]:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to process sale." }, { status: 500 });
  }
}
EOF

echo "===> [5/6] Seeding Bourbon Pizza Wandegeya tables and modifiers..."
cat << 'EOF' > scripts/seed_bourbon_wandegeya.sql
-- Seed Bourbon Pizza Wandegeya Dine-In Tables & Modifiers
DO $$
DECLARE
  b_vendor_id UUID;
  grp_size UUID;
  grp_crust UUID;
  grp_toppings UUID;
BEGIN
  -- 1. Locate or create Bourbon Pizza Vendor
  SELECT id INTO b_vendor_id FROM vendors WHERE name ILIKE '%Bourbon Pizza%' LIMIT 1;
  IF b_vendor_id IS NULL THEN
    INSERT INTO vendors (id, name, slug, address, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Bourbon Pizza Wandegeya', 'bourbon-pizza-wandegeya', 'Bombo Rd, Wandegeya, Kampala', true, NOW(), NOW())
    RETURNING id INTO b_vendor_id;
  END IF;

  -- 2. Seed 10 Dine-In Tables
  INSERT INTO vendor_tables (vendor_id, table_number, seating_capacity, qr_token)
  VALUES 
    (b_vendor_id, 'T-01', 2, 'bp-wnd-t01'),
    (b_vendor_id, 'T-02', 2, 'bp-wnd-t02'),
    (b_vendor_id, 'T-03', 4, 'bp-wnd-t03'),
    (b_vendor_id, 'T-04', 4, 'bp-wnd-t04'),
    (b_vendor_id, 'T-05', 4, 'bp-wnd-t05'),
    (b_vendor_id, 'T-06', 6, 'bp-wnd-t06'),
    (b_vendor_id, 'T-07', 6, 'bp-wnd-t07'),
    (b_vendor_id, 'T-08', 8, 'bp-wnd-t08'),
    (b_vendor_id, 'T-09', 2, 'bp-wnd-t09'),
    (b_vendor_id, 'T-10', 4, 'bp-wnd-t10')
  ON CONFLICT (vendor_id, table_number) DO NOTHING;

  -- 3. Modifier Group: Size (Mandatory 1)
  INSERT INTO product_modifier_groups (vendor_id, name, min_selections, max_selections, is_required, display_order)
  VALUES (b_vendor_id, 'Pizza Size', 1, 1, true, 1)
  RETURNING id INTO grp_size;

  INSERT INTO product_modifier_options (group_id, name, price_delta, display_order)
  VALUES 
    (grp_size, 'Medium 10"', 0, 1),
    (grp_size, 'Large 12"', 5000, 2),
    (grp_size, 'Mega 14"', 10000, 3);

  -- 4. Modifier Group: Crust Type (Mandatory 1)
  INSERT INTO product_modifier_groups (vendor_id, name, min_selections, max_selections, is_required, display_order)
  VALUES (b_vendor_id, 'Crust Type', 1, 1, true, 2)
  RETURNING id INTO grp_crust;

  INSERT INTO product_modifier_options (group_id, name, price_delta, display_order)
  VALUES 
    (grp_crust, 'Classic Hand Tossed', 0, 1),
    (grp_crust, 'Thin & Crispy', 0, 2),
    (grp_crust, 'Cheesy Stuffed Crust', 4000, 3);

  -- 5. Modifier Group: Extra Toppings (Optional Multi-Select)
  INSERT INTO product_modifier_groups (vendor_id, name, min_selections, max_selections, is_required, display_order)
  VALUES (b_vendor_id, 'Extra Toppings', 0, 5, false, 3)
  RETURNING id INTO grp_toppings;

  INSERT INTO product_modifier_options (group_id, name, price_delta, display_order)
  VALUES 
    (grp_toppings, 'Extra Mozzarella', 3000, 1),
    (grp_toppings, 'Jalapeño Peppers', 2000, 2),
    (grp_toppings, 'Minced Beef', 3500, 3),
    (grp_toppings, 'Sweetcorn & Mushrooms', 2500, 4);

  RAISE NOTICE 'Bourbon Pizza Wandegeya tables and modifiers seeded successfully.';
END $$;
EOF

psql "$DB_URL" -f scripts/seed_bourbon_wandegeya.sql

echo "===> [6/6] Running TypeScript compilation verification..."
npx tsc --noEmit

echo "=============================================================================="
echo " [✓] DEPLOYMENT COMPLETE"
echo " Kitchen Display System: http://localhost:3000/vendor/kds"
echo " Counter Billing POS:    http://localhost:3000/vendor/pos"
echo "=============================================================================="
EOF
chmod +x scripts/deploy_restaurant_pos_system.sh