/*
# Seed Sample Transactions (v2)
Inserts 3 completed transactions with line items.
Uses SELECT to fetch existing IDs instead of RETURNING (which returns null on conflict skip).
*/

DO $$
DECLARE
  tx1_id uuid; tx2_id uuid; tx3_id uuid;
  cust_walkin uuid; cust_alice uuid; cust_bob uuid;
  prod_nduma uuid; prod_fiddle uuid; prod_snake uuid; prod_pot uuid;
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

  -- Insert transactions (idempotent)
  INSERT INTO transactions (id, customer_id, cashier_id, total_amount, amount_paid, change_due, payment_method, sale_type, status)
  VALUES ('a0000000-0000-0000-0000-000000000001', cust_walkin, cashier_id, 6800, 7000, 200, 'cash', 'standard', 'completed')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transactions (id, customer_id, cashier_id, total_amount, amount_paid, change_due, payment_method, sale_type, status)
  VALUES ('a0000000-0000-0000-0000-000000000002', cust_alice, cashier_id, 4700, 4700, 0, 'mpesa', 'standard', 'completed')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transactions (id, customer_id, cashier_id, total_amount, amount_paid, change_due, payment_method, sale_type, status)
  VALUES ('a0000000-0000-0000-0000-000000000003', cust_bob, cashier_id, 5000, 5000, 0, 'card', 'wholesale', 'completed')
  ON CONFLICT (id) DO NOTHING;

  -- Fetch the IDs (works whether just inserted or already existed)
  SELECT id INTO tx1_id FROM transactions WHERE id = 'a0000000-0000-0000-0000-000000000001';
  SELECT id INTO tx2_id FROM transactions WHERE id = 'a0000000-0000-0000-0000-000000000002';
  SELECT id INTO tx3_id FROM transactions WHERE id = 'a0000000-0000-0000-0000-000000000003';

  -- Insert line items (idempotent via unique constraint check)
  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  SELECT tx1_id, prod_nduma, 'Nduma Zebra BIG Plant 1.5m', 1, 5000, 5000
  WHERE NOT EXISTS (SELECT 1 FROM transaction_items WHERE transaction_id = tx1_id AND product_id = prod_nduma);

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  SELECT tx1_id, prod_snake, 'Snake Plant Medium', 1, 1800, 1800
  WHERE NOT EXISTS (SELECT 1 FROM transaction_items WHERE transaction_id = tx1_id AND product_id = prod_snake);

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  SELECT tx2_id, prod_fiddle, 'Fiddle Leaf Fig 1m', 1, 3500, 3500
  WHERE NOT EXISTS (SELECT 1 FROM transaction_items WHERE transaction_id = tx2_id AND product_id = prod_fiddle);

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  SELECT tx2_id, prod_pot, 'Ceramic Pot 25cm', 1, 1200, 1200
  WHERE NOT EXISTS (SELECT 1 FROM transaction_items WHERE transaction_id = tx2_id AND product_id = prod_pot);

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  SELECT tx3_id, prod_nduma, 'Nduma Zebra BIG Plant 1.5m', 1, 3500, 3500
  WHERE NOT EXISTS (SELECT 1 FROM transaction_items WHERE transaction_id = tx3_id AND product_id = prod_nduma);

  INSERT INTO transaction_items (transaction_id, product_id, product_name, quantity, unit_price, subtotal)
  SELECT tx3_id, prod_pot, 'Ceramic Pot 25cm', 1, 1500, 1500
  WHERE NOT EXISTS (SELECT 1 FROM transaction_items WHERE transaction_id = tx3_id AND product_id = prod_pot);
END $$;
