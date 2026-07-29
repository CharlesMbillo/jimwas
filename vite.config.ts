import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, allowedHosts: ['sb-245ud9d4c88s.vercel.run'] },
})
