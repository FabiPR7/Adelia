import type { Express } from 'express'
import type { Plugin } from 'vite'

export function adeliaApiDevPlugin(): Plugin {
  return {
    name: 'adelia-api-dev',
    configureServer(server) {
      let app: Express | null = null

      const invalidate = (file: string) => {
        if (file.replace(/\\/g, '/').includes('/server/')) {
          app = null
        }
      }

      server.watcher.on('change', invalidate)
      server.watcher.on('add', invalidate)
      server.watcher.on('unlink', invalidate)

      const getApp = async () => {
        if (!app) {
          try {
            const mod = await server.ssrLoadModule('/server/createApp.ts') as { createApp: () => Express }
            app = mod.createApp()
          } catch {
            const mod = await import(`./createApp.ts?reload=${Date.now()}`) as { createApp: () => Express }
            app = mod.createApp()
          }
        }
        return app
      }

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api')) {
          next()
          return
        }

        void getApp()
          .then((loaded) => {
            loaded(req, res, next)
          })
          .catch((error: unknown) => {
            if (res.headersSent) {
              return
            }
            const message = error instanceof Error ? error.message : 'No se pudo arrancar la API local.'
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: message }))
          })
      })
    },
  }
}
