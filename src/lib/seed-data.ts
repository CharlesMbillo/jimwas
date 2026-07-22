import { supabase } from './supabase';

export const BACKUP_DATA = {
  products: [
    {
      id: 'prod-nduma-zebra',
      name: 'Nduma Zebra BIG Plant 1.5m',
      description: 'Big Nduma Zebra Plants',
      category: 'Plants',
      price: 5000,
      cost_price: 2500,
      quantity: 1,
      sku: 'NDUMA-ZEBRA-1.5M',
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-18-leaves-white',
      name: '18 Leaves White 80cm',
      description: '18 Leaves Plants',
      category: 'Plants',
      price: 1000,
      cost_price: 500,
      quantity: 1,
      sku: '18-LEAVES-WHITE-80CM',
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-18-leaves-banana',
      name: '18 Leaves Banana Dark 80cm',
      description: '18 Leaves Banana Plant',
      category: 'Plants',
      price: 1000,
      cost_price: 500,
      quantity: 5,
      sku: '18-LEAVES-BANANA-80CM',
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'prod-table-mats',
      name: 'Table Mats White',
      description: 'Mats',
      category: 'Mats',
      price: 250,
      cost_price: 125,
      quantity: 1,
      sku: 'TABLE-MATS-WHITE',
      active: true,
      created_at: new Date().toISOString(),
    },
  ],
  customers: [
    {
      id: 'cust-001',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+254708123456',
      address: 'Nairobi, Kenya',
      created_at: new Date().toISOString(),
    },
    {
      id: 'cust-002',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+254712345678',
      address: 'Mombasa, Kenya',
      created_at: new Date().toISOString(),
    },
  ],
};

export async function seedDatabase() {
  console.log('[v0] Starting database seeding...');

  try {
    const results = {
      products_seeded: 0,
      customers_seeded: 0,
      errors: [] as string[],
    };

    // Seed products
    console.log('[v0] Seeding products...');
    for (const product of BACKUP_DATA.products) {
      const { error } = await supabase.from('products').upsert([product], { onConflict: 'id' });

      if (error) {
        console.error(`[v0] Error seeding product ${product.name}:`, error);
        results.errors.push(`Product ${product.name}: ${error.message}`);
      } else {
        console.log(`[v0] Seeded product: ${product.name}`);
        results.products_seeded++;
      }
    }

    // Seed customers
    console.log('[v0] Seeding customers...');
    for (const customer of BACKUP_DATA.customers) {
      const { error } = await supabase.from('customers').upsert([customer], { onConflict: 'id' });

      if (error) {
        console.error(`[v0] Error seeding customer ${customer.name}:`, error);
        results.errors.push(`Customer ${customer.name}: ${error.message}`);
      } else {
        console.log(`[v0] Seeded customer: ${customer.name}`);
        results.customers_seeded++;
      }
    }

    console.log('[v0] Database seeding complete!', results);
    return results;
  } catch (err) {
    console.error('[v0] Fatal error during seeding:', err);
    throw err;
  }
}
