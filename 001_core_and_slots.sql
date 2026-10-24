-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & PROFILES (DPPA Data Isolation)
CREATE TYPE user_role AS ENUM ('customer', 'vendor_owner', 'rider', 'admin', 'super_admin');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL UNIQUE, -- E.164: +256...
    role user_role NOT NULL DEFAULT 'customer',
    trust_level INT NOT NULL DEFAULT 50 CHECK (trust_level BETWEEN 0 AND 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    -- nin_lookup_hash: HMAC-SHA256 of raw NIN with pepper for deduplication without plaintext search
    nin_lookup_hash VARCHAR(64) UNIQUE,
    -- encrypted_nin: Envelope encrypted (AES-256-GCM via KMS)
    encrypted_nin TEXT,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    purged_at TIMESTAMPTZ
);

-- 2. VENDORS & CAPACITY RULES
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    zone_id UUID, -- Foreign key set below after zones table
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    default_slot_capacity INT NOT NULL DEFAULT 5 CHECK (default_slot_capacity > 0),
    is_accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ZONES & TARIFFS
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE, -- Ntinda, Kiwaatule, Najjera, Kisaasi
    floor_fee INT NOT NULL,            -- e.g., 5000, 6000
    ceiling_fee INT NOT NULL,          -- e.g., 8000, 9000
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendors ADD CONSTRAINT fk_vendor_zone FOREIGN KEY (zone_id) REFERENCES zones(id);

CREATE TABLE zone_polygons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    coordinates JSONB NOT NULL -- GeoJSON Polygon coordinates [[lng, lat], ...]
);

-- 4. DELIVERY SLOTS (Hardened Concurrency)
CREATE TYPE slot_status AS ENUM ('open', 'full', 'closed');

CREATE TABLE delivery_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    capacity INT NOT NULL DEFAULT 5,
    booked INT NOT NULL DEFAULT 0,
    status slot_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT slot_capacity_integrity CHECK (booked <= capacity),
    CONSTRAINT slot_timing_check CHECK (slot_end > slot_start),
    UNIQUE(vendor_id, slot_start)
);

CREATE INDEX idx_delivery_slots_lookup 
ON delivery_slots (vendor_id, slot_start) 
WHERE status = 'open';

-- 5. SCHEDULED ORDERS & EXECUTION HOOKS
CREATE TYPE order_mode AS ENUM ('asap', 'scheduled');
CREATE TYPE order_status AS ENUM (
    'created', 'awaiting_payment', 'paid', 'scheduled_confirmed',
    'scheduled_activated', 'accepted', 'preparing', 'dispatched',
    'delivered', 'disputed', 'cancelled', 'refunded'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES users(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    rider_id UUID REFERENCES users(id),
    mode order_mode NOT NULL DEFAULT 'asap',
    status order_status NOT NULL DEFAULT 'created',
    product_subtotal INT NOT NULL,
    delivery_fee INT NOT NULL,
    service_fee INT NOT NULL,
    damage_protection_fee INT NOT NULL,
    convenience_fee INT NOT NULL,
    total_amount INT NOT NULL,
    payment_method VARCHAR(30) NOT NULL, -- 'pesapal', 'cod'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE scheduled_orders (
    order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES delivery_slots(id),
    scheduled_for TIMESTAMPTZ NOT NULL,
    prep_by TIMESTAMPTZ NOT NULL,
    rider_assign_at TIMESTAMPTZ NOT NULL,
    is_activated BOOLEAN NOT NULL DEFAULT FALSE,
    cancellation_deadline TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sched_unactivated_orders 
ON scheduled_orders (rider_assign_at) 
WHERE is_activated = FALSE;

-- 6. DOUBLE-ENTRY WALLET LEDGER
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    balance INT NOT NULL DEFAULT 0, -- UGX stored in integer units
    held_float INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE ledger_entry_type AS ENUM (
    'cod_deposit_hold', 'cod_cash_collected', 'rider_delivery_payout',
    'platform_commission', 'platform_delivery_share', 'damage_reserve_credit',
    'fuel_allowance_payout', 'refusal_fee_debit', 'rounding_surplus'
);

CREATE TABLE wallet_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    order_id UUID REFERENCES orders(id),
    entry_type ledger_entry_type NOT NULL,
    amount INT NOT NULL, -- Positive for credit, negative for debit
    balance_after INT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_ledger_audit ON wallet_ledger(wallet_id, created_at DESC);