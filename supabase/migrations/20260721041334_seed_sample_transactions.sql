/*
# Seed Sample Transaction Data

## Summary
Inserts sample completed transactions with line items so the Dashboard
and Void Requests pages have data to display on first load.

1. Data
   - 3 completed transactions with varied totals and payment methods
   - Line items referencing seeded products

2. Notes
   - Safe to re-run (ON CONFLICT DO NOTHING)
*/

DO $$
DECLARE
  tx1_id uuid;
  tx2_id uuid;
  tx3_id uuid;
  cust_walkin uuid;
  cust_alice uuid;
  cust_bob uuid;
  prod_nduma uuid;
  prod_fiddle uuid;
  prod_snake uuid;
  prod_pot uuid;
  cashier_id uuid;
BEGIN
  SELECT id INTO cust_walkin FROM customers WHERE name = 'Walk-in Customer' LIMIT 1;
  SELECT id INTO cust_alice FROM customers WHERE name = 'Alice Njeri' LIMIT 1;
  SELECT id INTO cust_bob FROM customers WHERE name = 'Bob Kamau' LIMIT 1;
  SELECT id INTO prod_nduma FROM products WHERE sku = 'NZP-150' LIMIT 1;
  SELECT id INTO prod_fiddle FROM products WHERE sku = 'FLF-100' LIMIT 1;
  SELECT id INTO prod_snake FROM products WHERE sku = 'SNK-MD' LIMIT 1;
  SELECT id INTO prod_pot FROM products WHERE sku = 'CER-25' LIMIT 1;
  SELECT id INTO cashier_id FROM pos_users WHERE email = 'cashier@jimwas.co.ke' LIMIT 1;

  -- Transaction 1: cash, walk-in
  INSERT INTO transactions (id, customer_id, cashier_id, total_amount, amount_paid, change_due, payment_method, sale_type, status)
  VALUES ('a0000000-0000-0000-0000-000000000001', cust_walkin, cashier_id, 6800, 7000, 200, 'cash', 'standard', 'completed')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO tx1_id;

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  VALUES
    (tx1_id, prod_nduma, 'Nduma Zebra BIG Plant 1.5m', 1, 5000, 5000),
    (tx1_id, prod_snake, 'Snake Plant Medium', 1, 1800, 1800)
  ON CONFLICT DO NOTHING;

  -- Transaction 2: mpesa, Alice
  INSERT INTO transactions (id, customer_id, cashier_id, total_amount, amount_paid, change_due, payment_method, sale_type, status)
  VALUES ('a0000000-0000-0000-0000-000000000002', cust_alice, cashier_id, 4700, 4700, 0, 'mpesa', 'standard', 'completed')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO tx2_id;

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  VALUES
    (tx2_id, prod_fiddle, 'Fiddle Leaf Fig 1m', 1, 3500, 3500),
    (tx2_id, prod_pot, 'Ceramic Pot 25cm', 1, 1200, 1200)
  ON CONFLICT DO NOTHING;

  -- Transaction 3: card, Bob (wholesale)
  INSERT INTO transactions (id, customer_id, cashier_id, total_amount, amount_paid, change_due, payment_method, sale_type, status)
  VALUES ('a0000000-0000-0000-0000-000000000003', cust_bob, cashier_id, 5000, 5000, 0, 'card', 'wholesale', 'completed')
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO tx3_id;

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  VALUES
    (tx3_id, prod_nduma, 'Nduma Zebra BIG Plant 1.5m', 1, 3500, 3500),
    (tx3_id, prod_pot, 'Ceramic Pot 25cm', 1, 1500, 1500)
  ON CONFLICT DO NOTHING;

  -- Decrement stock for the seeded transactions
  UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = prod_nduma;
  UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = prod_fiddle;
  UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = prod_snake;
  UPDATE products SET stock_quantity = stock_quantity - 2 WHERE id = prod_pot;
END $$;
