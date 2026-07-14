import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    allowedHosts: [
      'sb-4iuu9ihy54t7.vercel.run',
      'localhost',
      '127.0.0.1',
    ],
  },
});
