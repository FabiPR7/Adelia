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

export const api = onRequest(
  {
    region: 'europe-southwest1',
    memory: '512MiB',
    cpu: 1,
    timeoutSeconds: 60,
    maxInstances: 200,
    concurrency: 20,
  },
  async (req, res) => {
    const app = await getApp()
    return app(req, res)
  },
)
