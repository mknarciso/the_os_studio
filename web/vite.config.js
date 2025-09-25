import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@zazos/schemas": path.resolve(__dirname, "../../../../shared/schemas/dist/index.js")
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  optimizeDeps: {
    include: ['@zazos/schemas']
  },
  server: {
    port: 5177,
    host: true,
  },
})
