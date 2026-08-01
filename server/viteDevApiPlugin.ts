import type { Connect } from 'vite'
import type { Plugin } from 'vite'

export function adeliaApiDevPlugin(): Plugin {
  return {
    name: 'adelia-api-dev',
    configureServer(server) {
      let appPromise: Promise<Connect.HandleFunction> | null = null

      const getApp = () => {
        if (!appPromise) {
          appPromise = import('./createApp.ts').then(({ createApp }) => createApp())
        }

        return appPromise
      }

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''

        if (!url.startsWith('/api')) {
          next()
          return
        }

        void getApp().then((app) => {
          app(req, res, next)
        })
      })
    },
  }
}
