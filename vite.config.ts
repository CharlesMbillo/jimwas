import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    allowedHosts: ['sb-wf0gg366j80v.vercel.run', 'sb-542w4rxcsk4n.vercel.run'],
  },
})
