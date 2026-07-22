import { createClient } from '@supabase/supabase-js';

// Support multiple env var names for flexibility
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
                   import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
                   import.meta.env.SUPABASE_URL ||
                   '';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
                       import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                       import.meta.env.SUPABASE_ANON_KEY ||
                       '';

// Create a dummy client if credentials are missing to prevent initialization errors
let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  console.log('[Supabase] Connecting to:', supabaseUrl);
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('[Supabase] Environment variables not fully configured. Running in offline mode.');
  console.log('[Supabase] URL:', supabaseUrl ? 'configured' : 'missing');
  console.log('[Supabase] Key:', supabaseAnonKey ? 'configured' : 'missing');
  // Create a dummy client that will fail gracefully
  supabase = createClient('https://dummy.supabase.co', 'dummy-key');
}

export { supabase };
