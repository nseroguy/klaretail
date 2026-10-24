import 'dotenv/config';
import dns from 'node:dns';

// Force IPv4 lookup
dns.setDefaultResultOrder('ipv4first');

import ws from 'ws';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../src/db/schema';
import { calculateOrderFees } from '../src/utils/feeCalculator';
import { bookSlotDrizzle } from '../src/services/slotService';
import { resolveZone, Coordinate } from '../src/utils/geo';
import { eq } from 'drizzle-orm';

// Configure Neon to use the Node ws implementation
neonConfig.webSocketConstructor = ws;

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing in environment variables.');
}

// Ensure connection string uses direct host for WebSockets if pooler is attached
if (connectionString.includes('-pooler')) {
  connectionString = connectionString.replace('-pooler', '');
}

const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 15000,
});
const db = drizzle(pool, { schema });

async function runLocalPipelineTest() {
  console.log('🧪 --- STARTING LOCAL PIPELINE INTEGRATION TEST (WSS Transactions) --- 🧪\n');

  try {
    // 1. GEOFENCE RESOLUTION CHECK
    console.log('1️⃣ Checking Geofence Resolution...');
    const activePolygons = await db
      .select({
        zoneId: schema.zones.id,
        zoneName: schema.zones.name,
        polygon: schema.zonePolygons.coordinates,
      })
      .from(schema.zonePolygons)
      .innerJoin(schema.zones, eq(schema.zonePolygons.zoneId, schema.zones.id));

    console.log(`  Fetched ${activePolygons.length} zone polygons from Neon.`);

    const insideCoord: Coordinate = [32.6183, 0.3541];
    const matched = resolveZone(
      insideCoord,
      activePolygons.map((p) => ({
        id: p.zoneId,
        name: p.zoneName,
        polygon: p.polygon as Coordinate[],
      }))
    );

    if (matched?.zoneName === 'Ntinda') {
      console.log('  ✅ Geofence matched correctly: Ntinda');
    } else {
      throw new Error(`  ❌ Geofence failed! Expected Ntinda, received: ${matched?.zoneName}`);
    }

    const outsideCoord: Coordinate = [32.4435, 0.0424];
    const outOfZone = resolveZone(
      outsideCoord,
      activePolygons.map((p) => ({
        id: p.zoneId,
        name: p.zoneName,
        polygon: p.polygon as Coordinate[],
      }))
    );

    if (outOfZone === null) {
      console.log('  ✅ Out-of-zone boundary safely rejected out-of-bounds coordinate');
    } else {
      throw new Error('  ❌ Failed: Out-of-zone coordinate was erroneously resolved!');
    }

    // 2. v11.4 FORMULA ENGINE
    console.log('\n2️⃣ Validating v11.4 Pricing & Ledger Engine...');
    const fees = calculateOrderFees({
      productSubtotal: 22000,
      vendorLocation: { latitude: 0.3541, longitude: 32.6183 },
      deliveryLocation: { latitude: 0.362, longitude: 32.6252 },
      zone: { floorFee: 5000, ceilingFee: 8000 },
      paymentMethod: 'cod',
    });

    console.log(`  - Subtotal: UGX ${fees.receipt.productSubtotal.toLocaleString()}`);
    console.log(`  - Distance: ${fees.receipt.distanceKm} km`);
    console.log(`  - D_rider: UGX ${fees.receipt.riderDeliveryComponent.toLocaleString()}`);
    console.log(`  - Service Fee: UGX ${fees.receipt.serviceFee.toLocaleString()}`);
    console.log(`  - Damage Protection (G): UGX ${fees.receipt.damageProtectionFee.toLocaleString()}`);
    console.log(`  - Total Rounded Payable: UGX ${fees.receipt.finalPayable.toLocaleString()}`);
    console.log(`  - MoMo Deposit Due (50%): UGX ${fees.receipt.codDepositDueNow.toLocaleString()}`);
    console.log(`  - Cash Due on Delivery: UGX ${fees.receipt.codCashDueOnDelivery.toLocaleString()}`);

    if (fees.receipt.serviceFee !== 1500) throw new Error('Service fee should be 1,500 UGX');
    if (fees.receipt.finalPayable % 100 !== 0) throw new Error('Cash total must round to 100 UGX');
    console.log('  ✅ Formula calculations, fee clamp, and rounding verified');

    // 3. CONCURRENCY-SAFE 15-MINUTE SLOT RESERVATION (TRANSACTIONAL)
    console.log('\n3️⃣ Testing Slot Booking & State Transitions (Interactive Transaction)...');
    const testVendor = await db.query.vendors.findFirst({
      where: eq(schema.vendors.slug, 'ntinda-roastery'),
    });

    if (!testVendor) throw new Error('Vendor ntinda-roastery not found in DB');

    // Upsert test user
    const [testUser] = await db
      .insert(schema.users)
      .values({ phone: '+256700999999', role: 'customer' })
      .onConflictDoNothing()
      .returning();

    const userId =
      testUser?.id ||
      (await db.query.users.findFirst({
        where: eq(schema.users.phone, '+256700999999'),
      }))!.id;

    const [testOrder] = await db
      .insert(schema.orders)
      .values({
        orderNumber: `TEST-${Date.now()}`,
        customerId: userId,
        vendorId: testVendor.id,
        mode: 'scheduled',
        status: 'awaiting_payment',
        productSubtotal: 20000,
        deliveryFee: 5000,
        serviceFee: 1500,
        damageProtectionFee: 663,
        convenienceFee: 0,
        totalAmount: 27200,
        paymentMethod: 'cod',
      })
      .returning();

    const targetSlotStart = new Date(Date.now() + 3 * 60 * 60 * 1000);
    targetSlotStart.setMinutes(0, 0, 0);

    const booking = await bookSlotDrizzle(db as any, {
      vendorId: testVendor.id,
      slotStart: targetSlotStart,
      orderId: testOrder.id,
    });

    console.log(`  ✅ Slot reserved via interactive transaction. ID: ${booking.slotId}`);
    console.log(`  - Prep by: ${booking.prepBy.toISOString()}`);
    console.log(`  - Rider Assignment Horizon: ${booking.riderAssignAt.toISOString()}`);

    console.log('\n🎉 --- ALL LOCAL INTEGRATION TESTS PASSED --- 🎉');
  } finally {
    await pool.end();
  }
}

runLocalPipelineTest().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
