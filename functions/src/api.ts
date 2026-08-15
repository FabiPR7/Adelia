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
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (req, res) => {
    const app = await getApp()
    return app(req, res)
  },
)
