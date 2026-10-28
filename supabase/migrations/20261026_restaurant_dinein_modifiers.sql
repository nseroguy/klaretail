BEGIN;

-- 1. Extend order_fulfillment_type enum with 'dine_in'
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_fulfillment_type') THEN
    CREATE TYPE order_fulfillment_type AS ENUM ('delivery', 'pickup', 'walk_in', 'dine_in');
  ELSE
    ALTER TYPE order_fulfillment_type ADD VALUE IF NOT EXISTS 'dine_in';
  END IF;
END $$;

-- 2. Restaurant Physical Tables & Dynamic QR Tokens
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

-- 3. Table Sessions (Multi-Round Ordering & Shared Bill Lifecycle)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_session_status') THEN
    CREATE TYPE table_session_status AS ENUM ('open', 'bill_requested', 'settled', 'cancelled');
  END IF;
END $$;

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

-- 4. Product Modifiers (e.g., Pizza Size, Crust, Add-on Toppings)
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

CREATE TABLE IF NOT EXISTS product_modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  price_delta INT NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link Modifiers to Products
CREATE TABLE IF NOT EXISTS product_to_modifier_groups (
  product_id VARCHAR(255) NOT NULL,
  modifier_group_id UUID NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, modifier_group_id)
);

-- 5. Extend Orders & Order Items
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES vendor_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kitchen_notes VARCHAR(255);

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_tables_vendor ON vendor_tables(vendor_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_active ON table_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_table_session ON orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_dinein ON orders(fulfillment_type) WHERE fulfillment_type = 'dine_in';
CREATE INDEX IF NOT EXISTS idx_modifier_opts_group ON product_modifier_options(group_id);

COMMIT;
