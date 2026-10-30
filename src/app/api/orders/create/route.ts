import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('customer_session')?.value;
    let userId: string | null = null;
    let customerId: string | null = null;

    if (rawCookie) {
      try {
        let decoded = rawCookie;
        while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
        const session = JSON.parse(decoded);
        userId = session?.userId;
        customerId = session?.customerId;
      } catch {}
    }

    const body = await request.json().catch(() => ({}));
    const {
      vendorId: incomingVendorId,
      vendorSlug,
      channel = 'retail',
      paymentMethod = 'CASH_ON_DELIVERY',
      paymentTerms = 'immediate',
      poNumber = null,
      taxId = null,
      items = [],
      subtotal: clientSubtotal,
      deliveryFee: clientDeliveryFee
    } = body;

    // 1. Resolve Target Vendor
    let resolvedVendorId: string | null = incomingVendorId || null;
    if (!resolvedVendorId && vendorSlug) {
      const vRes: any = await db.execute(sql`
        SELECT id::text AS id FROM vendors WHERE slug = ${vendorSlug} LIMIT 1
      `);
      resolvedVendorId = Array.isArray(vRes) ? vRes[0]?.id : vRes?.rows?.[0]?.id;
    }

    if (!resolvedVendorId) {
      const vRes: any = await db.execute(sql`SELECT id::text AS id FROM vendors LIMIT 1`);
      resolvedVendorId = Array.isArray(vRes) ? vRes[0]?.id : vRes?.rows?.[0]?.id;
    }

    if (!resolvedVendorId) {
      return NextResponse.json({ success: false, message: 'No active vendor found.' }, { status: 400 });
    }

    // 2. Provision or resolve customer identity
    if (!userId || !customerId) {
      // Look up existing guest record first
      const existing: any = await db.execute(sql`
        SELECT c.id::text AS "customerId", c.user_id::text AS "userId"
        FROM customers c
        WHERE c.phone = '+256700000000'
        LIMIT 1;
      `);
      const guest = Array.isArray(existing) ? existing[0] : existing?.rows?.[0];

      if (guest && guest.userId && guest.customerId) {
        userId = guest.userId;
        customerId = guest.customerId;
      } else {
        const guestUserRes: any = await db.execute(sql`
          INSERT INTO users (phone, role, is_active, trust_level)
          VALUES ('+256700000000', 'customer'::user_role, true, 1)
          ON CONFLICT (phone) DO UPDATE SET is_active = true
          RETURNING id::text AS id;
        `);
        userId = guestUserRes?.[0]?.id || guestUserRes?.rows?.[0]?.id;

        const custRes: any = await db.execute(sql`
          INSERT INTO customers (user_id, phone, full_name)
          VALUES (${userId}::uuid, '+256700000000', 'B2B/Retail Customer')
          ON CONFLICT (phone) DO UPDATE 
          SET full_name = EXCLUDED.full_name, user_id = EXCLUDED.user_id
          RETURNING id::text AS id;
        `);
        customerId = custRes?.[0]?.id || custRes?.rows?.[0]?.id;
      }
    }

    // 3. Wholesale MOQ & Tier Pricing Validation
    let computedSubtotal = 0;
    const validatedItems: any[] = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const pId = item.id || item.productId;
        const qty = Number(item.quantity || 1);

        // Fetch authoritative product data from database
        const pRes: any = await db.execute(sql`
          SELECT id::text AS id, name, base_price::numeric AS "basePrice", wholesale_price::numeric AS "wholesalePrice", moq, tier_pricing AS "tierPricing"
          FROM products
          WHERE id = ${pId}::uuid
          LIMIT 1;
        `);
        const product = Array.isArray(pRes) ? pRes[0] : pRes?.rows?.[0];

        let unitPrice = Number(item.price || item.unitPrice || 0);

        if (product) {
          if (channel === 'wholesale') {
            // Enforce Minimum Order Quantity
            const requiredMoq = Number(product.moq || 1);
            if (qty < requiredMoq) {
              return NextResponse.json({
                success: false,
                message: `Minimum order quantity for "${product.name}" is ${requiredMoq} units (requested: ${qty}).`
              }, { status: 400 });
            }

            // Determine active base vendor wholesale tier price
            let vendorUnitPrice = Number(product.wholesalePrice || product.basePrice);
            const tiers = Array.isArray(product.tierPricing) ? product.tierPricing : [];
            const sortedTiers = [...tiers].sort((a, b) => Number(b.min) - Number(a.min));
            for (const tier of sortedTiers) {
              if (qty >= Number(tier.min)) {
                vendorUnitPrice = Number(tier.price);
                break;
              }
            }

            // Customer pays base wholesale price + 2% platform markup
            unitPrice = Math.round(vendorUnitPrice * 1.02);

            const lineTotal = unitPrice * qty;
            computedSubtotal += lineTotal;

            validatedItems.push({
              productId: pId,
              name: product?.name || item.name || 'Product Item',
              quantity: qty,
              unitPrice,
              vendorUnitPrice,
              totalPrice: lineTotal
            });
            continue;
          } else {
            unitPrice = Number(product.basePrice || unitPrice);
          }
        }

        const lineTotal = unitPrice * qty;
        computedSubtotal += lineTotal;

        validatedItems.push({
          productId: pId,
          name: product?.name || item.name || 'Product Item',
          quantity: qty,
          unitPrice,
          vendorUnitPrice: unitPrice,
          totalPrice: lineTotal
        });
      }
    } else {
      computedSubtotal = clientSubtotal !== undefined ? Number(clientSubtotal) : 38000;
    }

    const deliveryFee = clientDeliveryFee !== undefined ? Number(clientDeliveryFee) : (channel === 'wholesale' ? 15000 : 3000);
    const totalAmount = computedSubtotal + deliveryFee;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = channel === 'wholesale' ? 'WHL' : 'KLA';
    const orderNumber = `${prefix}-${dateStr}-${randomSuffix}`;
    const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

    // 4. Persist Order Record
    const orderResult: any = await db.execute(sql`
      INSERT INTO orders (
        order_number,
        customer_id,
        vendor_id,
        channel,
        payment_terms,
        po_number,
        tax_id,
        mode,
        status,
        product_subtotal,
        delivery_fee,
        service_fee,
        damage_protection_fee,
        convenience_fee,
        total_amount,
        payment_method,
        delivery_pin,
        cod_amount_due,
        created_at,
        updated_at
      ) VALUES (
        ${orderNumber},
        ${userId}::uuid,
        ${resolvedVendorId}::uuid,
        ${channel},
        ${paymentTerms},
        ${poNumber},
        ${taxId},
        'asap'::order_mode,
        'accepted'::order_status,
        ${computedSubtotal},
        ${deliveryFee},
        0,
        0,
        0,
        ${totalAmount},
        ${paymentMethod},
        ${deliveryPin},
        ${totalAmount},
        NOW(),
        NOW()
      )
      RETURNING 
        id::text AS id,
        order_number AS "orderNumber",
        vendor_id::text AS "vendorId",
        channel,
        payment_terms AS "paymentTerms",
        delivery_pin AS "deliveryPin",
        total_amount AS "totalAmount",
        status::text AS status,
        created_at AS "createdAt";
    `);

    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult?.rows?.[0];

    // 5. Insert Line Items
    if (validatedItems.length > 0) {
      for (const item of validatedItems) {
        await db.execute(sql`
          INSERT INTO order_items (
            order_id, product_id, name, quantity, unit_price, vendor_unit_price, total_price
          ) VALUES (
            ${order.id}::uuid,
            ${item.productId}::text,
            ${item.name},
            ${item.quantity},
            ${item.unitPrice},
            ${item.vendorUnitPrice || item.unitPrice},
            ${item.totalPrice}
          );
        `).catch(() => {});
      }
    }

    try {
      await logPlatformAudit({
        request,
        action: 'ORDER_PLACED',
        targetEntity: 'orders',
        targetId: order.id,
        actorId: customerId,
        actorRole: channel === 'wholesale' ? 'wholesale_buyer' : 'customer',
        metadata: { orderNumber, channel, totalAmount, paymentMethod, paymentTerms, poNumber }
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Order created successfully.',
      orderNumber: order.orderNumber,
      orderId: order.id,
      channel: order.channel,
      deliveryPin: order.deliveryPin,
      totalAmount: order.totalAmount,
      status: order.status
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to place order.' }, { status: 500 });
  }
}
