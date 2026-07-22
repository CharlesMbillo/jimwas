-- Seed backup data from jimwas-backup-2026-07-14.json

-- Insert products
INSERT INTO products (id, name, description, category, price, cost_price, quantity, sku, active, created_at, updated_at)
VALUES
  ('prod-nduma-zebra', 'Nduma Zebra BIG Plant 1.5m', 'Big Nduma Zebra Plants', 'Plants', 5000, 2500, 1, 'NDUMA-ZEBRA-1.5M', true, now(), now()),
  ('prod-18-leaves-white', '18 Leaves White 80cm', '18 Leaves Plants', 'Plants', 1000, 500, 1, '18-LEAVES-WHITE-80CM', true, now(), now()),
  ('prod-18-leaves-banana', '18 Leaves Banana Dark 80cm', '18 Leaves Banana Plant', 'Plants', 1000, 500, 5, '18-LEAVES-BANANA-80CM', true, now(), now()),
  ('prod-table-mats', 'Table Mats White', 'Mats', 'Mats', 250, 125, 1, 'TABLE-MATS-WHITE', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  cost_price = EXCLUDED.cost_price,
  quantity = EXCLUDED.quantity,
  sku = EXCLUDED.sku,
  active = EXCLUDED.active,
  updated_at = now();

-- Insert customers
INSERT INTO customers (id, name, email, phone, address, created_at, updated_at)
VALUES
  ('cust-001', 'John Doe', 'john@example.com', '+254708123456', 'Nairobi, Kenya', now(), now()),
  ('cust-002', 'Jane Smith', 'jane@example.com', '+254712345678', 'Mombasa, Kenya', now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  updated_at = now();

-- Log completion
SELECT 'Database seeding complete!' as message;
