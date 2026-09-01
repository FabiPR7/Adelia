import { onRequest } from 'firebase-functions/v2/https'
import type { Express } from 'express'

let cachedApp: Express | undefined

async function getApp(): Promise<Express> {
  if (!cachedApp) {
    const { createApp } = await import('../server/createApp.ts')
    cachedApp = createApp()
  }

  return cachedApp
}

/**
 * `API_MIN_INSTANCES` mantiene instancias calientes para evitar cold starts en
 * la ruta de reserva. Cuesta dinero (instancia siempre encendida), por eso el
 * valor por defecto es 0. Recomendado en producción: 1.
 */
const MIN_INSTANCES = Math.max(0, Number(process.env.API_MIN_INSTANCES ?? 0) || 0)

export const api = onRequest(
  {
    region: 'europe-southwest1',
    memory: '512MiB',
    cpu: 1,
    timeoutSeconds: 60,
    minInstances: MIN_INSTANCES,
    maxInstances: 200,
    concurrency: 20,
  },
  async (req, res) => {
    const app = await getApp()
    return app(req, res)
  },
)
