import { Router, type Request, type Response } from 'express'

/**
 * Recibe fallos de la web y los escribe en el formato que Google Cloud Error
 * Reporting agrupa y avisa por correo (se activa en la consola de Google Cloud).
 * No guarda IPs ni datos de la cuenta: solo el mensaje, la pila y la ruta.
 */
const router = Router()

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

router.post('/', (req: Request, res: Response) => {
  const message = clip(req.body?.message, 1000)
  if (!message) {
    res.status(400).json({ error: 'Falta el mensaje.' })
    return
  }
  const stack = clip(req.body?.stack, 4000)
  const path = clip(req.body?.path, 200)
  console.error(JSON.stringify({
    severity: 'ERROR',
    '@type': 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
    message: stack || message,
    serviceContext: { service: 'adelia-web' },
    context: {
      httpRequest: { url: path, userAgent: clip(req.headers['user-agent'], 300) },
      reportLocation: { functionName: clip(req.body?.origin, 60) || 'web' },
    },
  }))
  res.status(204).end()
})

export default router
