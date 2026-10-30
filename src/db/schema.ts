export const posShiftStatusEnum = pgEnum("pos_shift_status", ["open", "closed"]);

export const staffVerificationStatusEnum = pgEnum("staff_verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const vendorStaffRoleEnum = pgEnum("vendor_staff_role", [
  "vendor_admin",
  "cashier",
  "kitchen_staff",
  "waiter",
]);

export const vendorSectorEnum = pgEnum("vendor_sector_type", [
  "food_beverage",
  "retail_commerce",
]);

export const vendorSubCategoryEnum = pgEnum("vendor_sub_category_type", [
  "restaurant",
  "fast_food",
  "retail",
  "wholesale",
]);

export const restaurantServiceTypeEnum = pgEnum("restaurant_service_type", [
  "quick_service",
  "dine_in_hybrid",
  "table_service_only",
]);

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
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";
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
    isAcceptingOrders: boolean("is_accepting_orders"),
  serviceType: restaurantServiceTypeEnum("service_type").default("dine_in_hybrid"),
  sector: vendorSectorEnum("sector").default("food_beverage").notNull(),
  subCategory: vendorSubCategoryEnum("sub_category").default("restaurant").notNull(),
  enableTableOrdering: boolean("enable_table_ordering").default(true),
  enableQrOrdering: boolean("enable_qr_ordering").default(true),
    isApproved: boolean("is_approved").default(false),
    status: varchar("status", { length: 50 }).default("pending_approval"),
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

export const orderFulfillmentTypeEnum = pgEnum("order_fulfillment_type", [
  "delivery",
  "pickup",
  "walk_in",
]);


// --- RESTAURANT TABLES & MODIFIERS ---
export const tableSessionStatusEnum = pgEnum("table_session_status", [
  "open",
  "bill_requested",
  "settled",
  "cancelled",
]);

export const vendorTables = pgTable(
  "vendor_tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    tableNumber: varchar("table_number", { length: 16 }).notNull(),
    seatingCapacity: integer("seating_capacity").default(4).notNull(),
    qrToken: varchar("qr_token", { length: 64 }).unique(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("uq_vendor_table_number").on(table.vendorId, table.tableNumber),
    index("idx_vendor_tables_vendor").on(table.vendorId),
  ]
);

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => vendorTables.id, { onDelete: "cascade" }),
    waiterId: uuid("waiter_id").references(() => users.id, { onDelete: "set null" }),
    status: tableSessionStatusEnum("status").default("open").notNull(),
    guestCount: integer("guest_count").default(1),
    notes: text("notes"),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    totalBilled: integer("total_billed").default(0).notNull(),
    totalSettled: integer("total_settled").default(0).notNull(),
  },
  (table) => [
    index("idx_table_sessions_active").on(table.tableId, table.status),
  ]
);

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    minSelections: integer("min_selections").default(0).notNull(),
    maxSelections: integer("max_selections").default(1).notNull(),
    isRequired: boolean("is_required").default(false).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export const productModifierOptions = pgTable(
  "product_modifier_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => productModifierGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    priceDelta: integer("price_delta").default(0).notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_modifier_opts_group").on(table.groupId),
  ]
);

export const productToModifierGroups = pgTable(
  "product_to_modifier_groups",
  {
    productId: varchar("product_id", { length: 255 }).notNull(),
    modifierGroupId: uuid("modifier_group_id")
      .notNull()
      .references(() => productModifierGroups.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.modifierGroupId] }),
  ]
);


// --- ORDERS ---
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 32 }).notNull().unique(),
  customerId: uuid('customer_id')
    .references(() => users.id),
  fulfillmentType: orderFulfillmentTypeEnum('fulfillment_type').default('delivery').notNull(),
  cashierId: uuid('cashier_id').references(() => users.id),
  posTerminalId: varchar('pos_terminal_id', { length: 64 }),
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
  channel: varchar('channel', { length: 30 }).default('retail').notNull(),
  paymentTerms: varchar('payment_terms', { length: 30 }).default('immediate').notNull(),
  poNumber: varchar('po_number', { length: 100 }),
  taxId: varchar('tax_id', { length: 50 }),
  // COD Escrow Fields
  deliveryPin: varchar('delivery_pin', { length: 6 }),
  codAmountDue: integer('cod_amount_due').default(0),
  codCashReceived: integer('cod_cash_received').default(0),
  codVerifiedAt: timestamp('cod_verified_at', { withTimezone: true }),
  tableId: uuid('table_id').references(() => vendorTables.id, { onDelete: "set null" }),
  tableSessionId: uuid('table_session_id').references(() => tableSessions.id, { onDelete: "set null" }),
  waiterId: uuid('waiter_id').references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
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
  vendorUnitPrice: integer('vendor_unit_price'),
  quantity: integer('quantity').notNull(),
  totalPrice: integer('total_price').notNull(),
  selectedModifiers: jsonb('selected_modifiers').$type<Array<{ groupName: string; optionName: string; priceDelta: number }>>().default([]),
  kitchenNotes: varchar('kitchen_notes', { length: 255 }),
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


export const vendorTablesRelations = relations(vendorTables, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [vendorTables.vendorId],
    references: [vendors.id],
  }),
  sessions: many(tableSessions),
  orders: many(orders),
}));

export const tableSessionsRelations = relations(tableSessions, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [tableSessions.vendorId],
    references: [vendors.id],
  }),
  table: one(vendorTables, {
    fields: [tableSessions.tableId],
    references: [vendorTables.id],
  }),
  waiter: one(users, {
    fields: [tableSessions.waiterId],
    references: [users.id],
  }),
  orders: many(orders),
}));

export const productModifierGroupsRelations = relations(
  productModifierGroups,
  ({ one, many }) => ({
    vendor: one(vendors, {
      fields: [productModifierGroups.vendorId],
      references: [vendors.id],
    }),
    options: many(productModifierOptions),
    productLinks: many(productToModifierGroups),
  })
);

export const productModifierOptionsRelations = relations(
  productModifierOptions,
  ({ one }) => ({
    group: one(productModifierGroups, {
      fields: [productModifierOptions.groupId],
      references: [productModifierGroups.id],
    }),
  })
);

export const productToModifierGroupsRelations = relations(
  productToModifierGroups,
  ({ one }) => ({
    modifierGroup: one(productModifierGroups, {
      fields: [productToModifierGroups.modifierGroupId],
      references: [productModifierGroups.id],
    }),
  })
);


export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 64 }),
  barcode: varchar("barcode", { length: 64 }),
  category: varchar("category", { length: 64 }).default("General").notNull(),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull().default("0"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).default("0"),
  wholesalePrice: numeric("wholesale_price", { precision: 12, scale: 2 }),
  weightKg: numeric("weight_kg", { precision: 8, scale: 2 }).default("1.0").notNull(),
  moq: integer("moq").default(1).notNull(),
  tierPricing: jsonb("tier_pricing").default([]),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  trackInventory: boolean("track_inventory").default(false).notNull(),
  requiresKitchenPrep: boolean("requires_kitchen_prep").default(false).notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vendorStaff = pgTable("vendor_staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 128 }).notNull(),
  email: varchar("email", { length: 128 }),
  phoneNumber: varchar("phone_number", { length: 32 }).notNull(),
  role: vendorStaffRoleEnum("role").default("cashier").notNull(),
  posPin: varchar("pos_pin", { length: 64 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  nationalIdNumber: varchar("national_id_number", { length: 64 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 32 }),
  verificationStatus: staffVerificationStatusEnum("verification_status").default("unverified").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const posShifts = pgTable("pos_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  cashierId: uuid("cashier_id").references(() => vendorStaff.id, { onDelete: "set null" }),
  cashierName: varchar("cashier_name", { length: 128 }).notNull(),
  status: posShiftStatusEnum("status").default("open").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingFloat: numeric("opening_float", { precision: 12, scale: 2 }).default("0").notNull(),
  cashSales: numeric("cash_sales", { precision: 12, scale: 2 }).default("0").notNull(),
  momoSales: numeric("momo_sales", { precision: 12, scale: 2 }).default("0").notNull(),
  cardSales: numeric("card_sales", { precision: 12, scale: 2 }).default("0").notNull(),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }).default("0").notNull(),
  paidOut: numeric("paid_out", { precision: 12, scale: 2 }).default("0").notNull(),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }).default("0").notNull(),
  actualCashCounted: numeric("actual_cash_counted", { precision: 12, scale: 2 }),
  cashDifference: numeric("cash_difference", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payoutDestinations = pgTable('payout_destinations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  channel: text('channel').notNull(), // 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER'
  accountNumber: text('account_number').notNull(), // Phone number or Bank account
  accountName: text('account_name').notNull(),
  bankCode: text('bank_code'), // Optional for bank transfer
  isDefault: boolean('is_default').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- B2B UPSTREAM SUPPLY CHAIN ---
export const b2bOrderStatusEnum = pgEnum("b2b_order_status", [
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "IN_TRANSIT",
  "DELIVERED_AND_RECEIVED",
  "CANCELLED",
]);

export const wholesaleProductTiers = pgTable("wholesale_product_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  wholesalerVendorId: uuid("wholesaler_vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  unitOfMeasure: text("unit_of_measure").notNull(),
  minOrderQuantity: integer("min_order_quantity").notNull().default(1),
  tierPrice: integer("tier_price").notNull(),
  stockUnitsAvailable: integer("stock_units_available").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const b2bPurchaseOrders = pgTable("b2b_purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  retailVendorId: uuid("retail_vendor_id").notNull().references(() => vendors.id),
  wholesalerVendorId: uuid("wholesaler_vendor_id").notNull().references(() => vendors.id),
  status: b2bOrderStatusEnum("status").notNull().default("SUBMITTED"),
  subtotal: integer("subtotal").notNull(),
  deliveryFee: integer("delivery_fee").notNull().default(0),
  totalAmount: integer("total_amount").notNull(),
  paymentTerms: text("payment_terms").notNull().default("PREPAID_WALLET"),
  paymentStatus: text("payment_status").notNull().default("HELD_ESCROW"),
  deliveryAddress: text("delivery_address").notNull(),
  handoverPin: text("handover_pin").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const b2bPurchaseOrderItems = pgTable("b2b_purchase_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id").notNull().references(() => b2bPurchaseOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  unitOfMeasure: text("unit_of_measure").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  totalPrice: integer("total_price").notNull(),
});
