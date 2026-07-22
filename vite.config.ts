import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 3000,
    allowedHosts: ['sb-19rbg5j3p02d.vercel.run', 'sb-4y7kqlr7orwf.vercel.run']
  },
  define: {
    'import.meta.env.VITE_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL),
    'import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  }
})
