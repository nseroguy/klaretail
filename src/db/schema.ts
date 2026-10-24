import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ==========================================
// 1. ENUMS
// ==========================================

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'vendor_owner',
  'rider',
  'admin',
  'super_admin',
]);

export const slotStatusEnum = pgEnum('slot_status', [
  'open',
  'full',
  'closed',
]);

export const orderModeEnum = pgEnum('order_mode', [
  'asap',
  'scheduled',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'created',
  'awaiting_payment',
  'paid',
  'scheduled_confirmed',
  'scheduled_activated',
  'accepted',
  'preparing',
  'dispatched',
  'delivered',
  'disputed',
  'cancelled',
  'refunded',
]);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'cod_deposit_hold',
  'cod_cash_collected',
  'rider_delivery_payout',
  'platform_commission',
  'platform_delivery_share',
  'damage_reserve_credit',
  'fuel_allowance_payout',
  'refusal_fee_debit',
  'rounding_surplus',
]);

// ==========================================
// 2. TABLES
// ==========================================

// --- USERS ---
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
    role: userRoleEnum('role').default('customer').notNull(),
    trustLevel: integer('trust_level').default(50).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('users_trust_level_check', sql`${table.trustLevel} BETWEEN 0 AND 100`),
  ]
);

// --- USER PROFILES (NIN Isolation & DPPA) ---
export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  ninLookupHash: varchar('nin_lookup_hash', { length: 64 }).unique(),
  encryptedNin: text('encrypted_nin'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
});

// --- ZONES & TARIFFS ---
export const zones = pgTable('zones', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  floorFee: integer('floor_fee').notNull(),
  ceilingFee: integer('ceiling_fee').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- ZONE POLYGONS ---
export const zonePolygons = pgTable('zone_polygons', {
  id: uuid('id').defaultRandom().primaryKey(),
  zoneId: uuid('zone_id')
    .notNull()
    .references(() => zones.id, { onDelete: 'cascade' }),
  coordinates: jsonb('coordinates').notNull(), // GeoJSON Array: [[lng, lat], ...]
});

// --- VENDORS ---
export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    zoneId: uuid('zone_id').references(() => zones.id),
    latitude: numeric('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: numeric('longitude', { precision: 9, scale: 6 }).notNull(),
    defaultSlotCapacity: integer('default_slot_capacity').default(5).notNull(),
    isAcceptingOrders: boolean('is_accepting_orders').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('vendors_slot_capacity_check', sql`${table.defaultSlotCapacity} > 0`),
  ]
);

// --- DELIVERY SLOTS ---
export const deliverySlots = pgTable(
  'delivery_slots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    slotStart: timestamp('slot_start', { withTimezone: true }).notNull(),
    slotEnd: timestamp('slot_end', { withTimezone: true }).notNull(),
    capacity: integer('capacity').default(5).notNull(),
    booked: integer('booked').default(0).notNull(),
    status: slotStatusEnum('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_vendor_slot_start_unique').on(table.vendorId, table.slotStart),
    index('idx_delivery_slots_lookup')
      .on(table.vendorId, table.slotStart)
      .where(sql`${table.status} = 'open'`),
    check('slot_capacity_integrity', sql`${table.booked} <= ${table.capacity}`),
    check('slot_timing_check', sql`${table.slotEnd} > ${table.slotStart}`),
  ]
);

// --- ORDERS ---
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 32 }).notNull().unique(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => users.id),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  riderId: uuid('rider_id').references(() => users.id),
  mode: orderModeEnum('mode').default('asap').notNull(),
  status: orderStatusEnum('status').default('created').notNull(),
  productSubtotal: integer('product_subtotal').notNull(),
  deliveryFee: integer('delivery_fee').notNull(),
  serviceFee: integer('service_fee').notNull(),
  damageProtectionFee: integer('damage_protection_fee').notNull(),
  convenienceFee: integer('convenience_fee').notNull(),
  totalAmount: integer('total_amount').notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // 'pesapal' | 'cod'
  deliveryPin: varchar('delivery_pin', { length: 10 }),
  codAmountDue: numeric('cod_amount_due', { precision: 12, scale: 2 }).default('0'),
  codCashReceived: numeric('cod_cash_received', { precision: 12, scale: 2 }).default('0'),
  codVerifiedAt: timestamp('cod_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- ORDER ITEMS ---
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  totalPrice: integer('total_price').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- SCHEDULED ORDERS ---
export const scheduledOrders = pgTable(
  'scheduled_orders',
  {
    orderId: uuid('order_id')
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    slotId: uuid('slot_id')
      .notNull()
      .references(() => deliverySlots.id),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    prepBy: timestamp('prep_by', { withTimezone: true }).notNull(),
    riderAssignAt: timestamp('rider_assign_at', { withTimezone: true }).notNull(),
    isActivated: boolean('is_activated').default(false).notNull(),
    cancellationDeadline: timestamp('cancellation_deadline', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sched_unactivated_orders')
      .on(table.riderAssignAt)
      .where(sql`${table.isActivated} = FALSE`),
  ]
);

// --- WALLETS ---
export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  balance: integer('balance').default(0).notNull(),
  heldFloat: integer('held_float').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- WALLET LEDGER (Append-Only) ---
export const walletLedger = pgTable(
  'wallet_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id),
    orderId: uuid('order_id').references(() => orders.id),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    amount: integer('amount').notNull(), // Positive = Credit, Negative = Debit
    balanceAfter: integer('balance_after').notNull(),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_wallet_ledger_audit').on(table.walletId, table.createdAt),
  ]
);

// ==========================================
// 3. DRIZZLE RELATIONS (Application Layer)
// ==========================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  wallet: one(wallets, {
    fields: [users.id],
    references: [wallets.userId],
  }),
  ownedVendors: many(vendors),
  customerOrders: many(orders, { relationName: 'customerOrders' }),
  riderOrders: many(orders, { relationName: 'riderOrders' }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const zonesRelations = relations(zones, ({ many }) => ({
  vendors: many(vendors),
  polygons: many(zonePolygons),
}));

export const zonePolygonsRelations = relations(zonePolygons, ({ one }) => ({
  zone: one(zones, {
    fields: [zonePolygons.zoneId],
    references: [zones.id],
  }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  owner: one(users, {
    fields: [vendors.ownerId],
    references: [users.id],
  }),
  zone: one(zones, {
    fields: [vendors.zoneId],
    references: [zones.id],
  }),
  deliverySlots: many(deliverySlots),
  orders: many(orders),
}));

export const deliverySlotsRelations = relations(deliverySlots, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [deliverySlots.vendorId],
    references: [vendors.id],
  }),
  scheduledOrders: many(scheduledOrders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
    relationName: 'customerOrders',
  }),
  vendor: one(vendors, {
    fields: [orders.vendorId],
    references: [vendors.id],
  }),
  rider: one(users, {
    fields: [orders.riderId],
    references: [users.id],
    relationName: 'riderOrders',
  }),
  items: many(orderItems),
  scheduledOrder: one(scheduledOrders, {
    fields: [orders.id],
    references: [scheduledOrders.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const scheduledOrdersRelations = relations(scheduledOrders, ({ one }) => ({
  order: one(orders, {
    fields: [scheduledOrders.orderId],
    references: [orders.id],
  }),
  slot: one(deliverySlots, {
    fields: [scheduledOrders.slotId],
    references: [deliverySlots.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  ledgerEntries: many(walletLedger),
}));

export const walletLedgerRelations = relations(walletLedger, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletLedger.walletId],
    references: [wallets.id],
  }),
  order: one(orders, {
    fields: [walletLedger.orderId],
    references: [orders.id],
  }),
}));

// Ensure this enum is declared only once:
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'completed',
  'failed',
  'reversed',
  'abandoned',
]);

// Ensure this table is declared only once:
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  providerRef: varchar('provider_ref', { length: 100 }),
  merchantRef: varchar('merchant_ref', { length: 50 }).notNull().unique(),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 10 }).default('UGX').notNull(),
  status: paymentStatusEnum('status').default('pending').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  confirmationCode: varchar('confirmation_code', { length: 100 }),
  rawPayload: jsonb('raw_payload').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const riders = pgTable('riders', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  vehiclePlate: varchar('vehicle_plate', { length: 50 }).notNull(),
  isActive: boolean('is_active').default(true),
  isAvailable: boolean('is_available').default(true),
  currentLat: numeric('current_lat', { precision: 10, scale: 7 }),
  currentLng: numeric('current_lng', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
