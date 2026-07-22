import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: 'ES2020',
    minify: 'esbuild',
    reportCompressedSize: false,
  },
  esbuild: {
    target: 'ES2020',
  },
  resolve: {
    extensions: ['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx'],
  },
})
