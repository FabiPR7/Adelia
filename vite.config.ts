import 'dotenv/config'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { adeliaApiDevPlugin } from './server/viteDevApiPlugin.ts'
import { adeliaSecurityHeadersPlugin } from './server/security/viteHeadersPlugin.ts'

export default defineConfig({
  plugins: [react(), tailwindcss(), adeliaSecurityHeadersPlugin(), adeliaApiDevPlugin()],
  optimizeDeps: {
    include: ['qrcode'],
    exclude: ['firebase-admin'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/leaflet')) return 'leaflet'
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          if (id.includes('node_modules/framer-motion')) return 'motion'
          if (id.includes('node_modules/@stripe')) return 'stripe'
        },
      },
    },
  },
  ssr: {
    external: ['firebase-admin'],
  },
})
