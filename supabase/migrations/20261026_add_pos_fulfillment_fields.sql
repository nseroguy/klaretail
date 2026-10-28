BEGIN;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_fulfillment_type') THEN
    CREATE TYPE order_fulfillment_type AS ENUM ('delivery', 'pickup', 'walk_in');
  END IF;
END $$;

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS fulfillment_type order_fulfillment_type NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS cashier_id UUID,
  ADD COLUMN IF NOT EXISTS pos_terminal_id VARCHAR(64);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_orders_cashier_id' AND table_name = 'orders'
    ) THEN
      ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_cashier_id 
        FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON orders(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_cashier_id ON orders(cashier_id) WHERE cashier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pos_terminal ON orders(pos_terminal_id) WHERE pos_terminal_id IS NOT NULL;

COMMIT;
