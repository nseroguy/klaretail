import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

// Direct connection for migrations/seeding (bypassing connection pooler proxy)
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Starting seed for Kampala Food Marketplace...');

  // 1. SEED ZONES & FEE BANDS (v11.4 Decision Record)
  console.log('📍 Seeding delivery zones...');
  const zoneData = [
    { name: 'Ntinda', floorFee: 5000, ceilingFee: 8000 },
    { name: 'Kiwaatule', floorFee: 5000, ceilingFee: 8000 },
    { name: 'Najjera', floorFee: 6000, ceilingFee: 9000 },
    { name: 'Kisaasi', floorFee: 6000, ceilingFee: 9000 },
  ];

  const insertedZones = await db
    .insert(schema.zones)
    .values(zoneData)
    .onConflictDoNothing({ target: schema.zones.name })
    .returning();

  // Fetch all zones to ensure referenceable IDs even if already seeded
  const allZones = await db.select().from(schema.zones);
  const zoneMap = new Map(allZones.map((z) => [z.name, z.id]));

  // 2. SEED ZONE POLYGONS (GeoJSON standard: [longitude, latitude])
  console.log('🗺️  Seeding zone boundary polygons...');
  const polygonData = [
    {
      zoneId: zoneMap.get('Ntinda')!,
      // Ntinda boundary (Stretcher, Ministers Village, Ntinda Nakawa junction)
      coordinates: [
        [32.6105, 0.3501],
        [32.6252, 0.3620],
        [32.6285, 0.3512],
        [32.6201, 0.3425],
        [32.6105, 0.3501], // Closed loop
      ],
    },
    {
      zoneId: zoneMap.get('Kiwaatule')!,
      // Kiwaatule boundary (Northern Bypass corridor to Nalya border)
      coordinates: [
        [32.6231, 0.3642],
        [32.6350, 0.3750],
        [32.6412, 0.3665],
        [32.6295, 0.3580],
        [32.6231, 0.3642],
      ],
    },
    {
      zoneId: zoneMap.get('Najjera')!,
      // Najjera 1 & 2 corridor toward Kira road
      coordinates: [
        [32.6280, 0.3770],
        [32.6390, 0.3950],
        [32.6510, 0.3880],
        [32.6385, 0.3720],
        [32.6280, 0.3770],
      ],
    },
    {
      zoneId: zoneMap.get('Kisaasi')!,
      // Kisaasi & Kyanja boundary
      coordinates: [
        [32.5980, 0.3620],
        [32.6120, 0.3780],
        [32.6210, 0.3710],
        [32.6095, 0.3575],
        [32.5980, 0.3620],
      ],
    },
  ];

  await db.insert(schema.zonePolygons).values(polygonData);

  // 3. SEED VENDOR OWNERS & WALLETS
  console.log('👤 Seeding vendor owners and initial wallets...');
  const ownerUsers = [
    {
      phone: '+256772000001',
      role: 'vendor_owner' as const,
      trustLevel: 80,
    },
    {
      phone: '+256772000002',
      role: 'vendor_owner' as const,
      trustLevel: 80,
    },
    {
      phone: '+256772000003',
      role: 'vendor_owner' as const,
      trustLevel: 80,
    },
  ];

  const insertedOwners = await db
    .insert(schema.users)
    .values(ownerUsers)
    .onConflictDoNothing({ target: schema.users.phone })
    .returning();

  const ownersList = await db.select().from(schema.users);
  const ownerPhoneMap = new Map(ownersList.map((u) => [u.phone, u.id]));

  // Ensure every owner has an initial empty wallet
  for (const owner of ownerUsers) {
    const ownerId = ownerPhoneMap.get(owner.phone)!;
    await db
      .insert(schema.wallets)
      .values({
        userId: ownerId,
        balance: 0,
        heldFloat: 0,
      })
      .onConflictDoNothing({ target: schema.wallets.userId });
  }

  // 4. SEED TEST VENDORS
  console.log('🍳 Seeding test restaurants & kitchens...');
  const vendorsData = [
    {
      ownerId: ownerPhoneMap.get('+256772000001')!,
      name: 'Ntinda Fried Chicken & Roastery',
      slug: 'ntinda-roastery',
      zoneId: zoneMap.get('Ntinda')!,
      latitude: '0.354100',
      longitude: '32.618300',
      defaultSlotCapacity: 5,
      isAcceptingOrders: true,
    },
    {
      ownerId: ownerPhoneMap.get('+256772000002')!,
      name: 'Kiwaatule Grill & Local Dishes',
      slug: 'kiwaatule-grill',
      zoneId: zoneMap.get('Kiwaatule')!,
      latitude: '0.367200',
      longitude: '32.628800',
      defaultSlotCapacity: 6,
      isAcceptingOrders: true,
    },
    {
      ownerId: ownerPhoneMap.get('+256772000003')!,
      name: 'Najjera Fresh Kitchen',
      slug: 'najjera-fresh',
      zoneId: zoneMap.get('Najjera')!,
      latitude: '0.381500',
      longitude: '32.634100',
      defaultSlotCapacity: 4,
      isAcceptingOrders: true,
    },
  ];

  await db
    .insert(schema.vendors)
    .values(vendorsData)
    .onConflictDoNothing({ target: schema.vendors.slug });

  console.log('✅ Seeding completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});