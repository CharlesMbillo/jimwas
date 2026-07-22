import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database backup data from jimwas-backup-2026-07-14.json
const backupData = {
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

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Seed products
    console.log('📦 Seeding products...');
    for (const product of backupData.products) {
      const { data, error } = await supabase
        .from('products')
        .upsert([product], { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error seeding product ${product.name}:`, error);
      } else {
        console.log(`✅ Seeded product: ${product.name}`);
      }
    }

    // Seed customers
    console.log('\n👥 Seeding customers...');
    for (const customer of backupData.customers) {
      const { data, error } = await supabase
        .from('customers')
        .upsert([customer], { onConflict: 'id' });

      if (error) {
        console.error(`❌ Error seeding customer ${customer.name}:`, error);
      } else {
        console.log(`✅ Seeded customer: ${customer.name}`);
      }
    }

    console.log('\n✨ Database seeding complete!');
  } catch (err) {
    console.error('❌ Fatal error during seeding:', err);
    process.exit(1);
  }
}

seedDatabase();
