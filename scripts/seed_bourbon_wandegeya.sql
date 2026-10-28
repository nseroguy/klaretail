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
