import 'dotenv/config'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { adeliaApiDevPlugin } from './server/viteDevApiPlugin.ts'

export default defineConfig({
  plugins: [react(), adeliaApiDevPlugin()],
  optimizeDeps: {
    include: ['qrcode'],
    exclude: ['firebase-admin'],
  },
  ssr: {
    external: ['firebase-admin'],
  },
})
