import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  // Check for authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SEED_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Missing Supabase credentials' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

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

  try {
    const results = {
      products_seeded: 0,
      customers_seeded: 0,
      errors: [] as string[],
    };

    // Seed products
    for (const product of backupData.products) {
      const { error } = await supabase
        .from('products')
        .upsert([product], { onConflict: 'id' });

      if (error) {
        results.errors.push(`Product ${product.name}: ${error.message}`);
      } else {
        results.products_seeded++;
      }
    }

    // Seed customers
    for (const customer of backupData.customers) {
      const { error } = await supabase
        .from('customers')
        .upsert([customer], { onConflict: 'id' });

      if (error) {
        results.errors.push(`Customer ${customer.name}: ${error.message}`);
      } else {
        results.customers_seeded++;
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Database seeding complete',
        ...results,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: `Seeding failed: ${error}` },
      { status: 500 }
    );
  }
}
