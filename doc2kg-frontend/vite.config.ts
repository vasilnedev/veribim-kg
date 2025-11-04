import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/doc2kg-frontend/',
  server: {
    port: 80,
    allowedHosts: true
  }
})
