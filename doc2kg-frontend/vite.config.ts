import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/doc2kg-frontend/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 80,
    host: true,
    allowedHosts: true,
    watch: {
      usePolling: true
    },
    hmr: {
      protocol: 'ws'
    }
  },
  preview: {
    port: 80,
    host: true,
    allowedHosts: true
  }
})


