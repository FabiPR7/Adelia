import 'dotenv/config'
import { existsSync, readFileSync } from 'node:fs'
import { parse as parseDotenv } from 'dotenv'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { adeliaApiDevPlugin } from './server/viteDevApiPlugin.ts'
import { adeliaSecurityHeadersPlugin } from './server/security/viteHeadersPlugin.ts'

/**
 * `dotenv/config` mete `.env` (desarrollo) en process.env para la API local, y Vite
 * da prioridad a process.env sobre `.env.production`: la web publicada salía con la
 * clave de Stripe de desarrollo. Al construir se quitan las VITE_ que vienen de `.env`.
 */
function dropDevViteVars() {
  if (!existsSync('.env')) return
  const devVars = parseDotenv(readFileSync('.env'))
  for (const [key, value] of Object.entries(devVars)) {
    if (key.startsWith('VITE_') && process.env[key] === value) {
      delete process.env[key]
    }
  }
}

export default defineConfig(({ command }) => {
  if (command === 'build') dropDevViteVars()
  return {
    plugins: [react(), tailwindcss(), adeliaSecurityHeadersPlugin(), adeliaApiDevPlugin()],
    server: {
      // Permite abrir el dev server a través de un túnel (cloudflared / ngrok)
      // para probar webhooks. Solo afecta a `npm run dev`.
      allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.loca.lt'],
    },
    optimizeDeps: {
      include: ['qrcode'],
      exclude: ['firebase-admin'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
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
  }
})
