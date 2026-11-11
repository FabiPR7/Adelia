import { createHash } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { adminAuth } from '../firebase-admin.ts'

/**
 * Firma subidas a Cloudinary desde el servidor. Con firma, nadie puede usar la
 * cuenta para subir lo que quiera: cada subida lleva carpeta, formatos y una
 * caducidad que decide Adelia. Se activa al configurar `CLOUDINARY_API_KEY` y
 * `CLOUDINARY_API_SECRET`; sin ellas responde `enabled: false` y la web sigue
 * con el preset sin firmar.
 */
const router = Router()

const FORMATS = {
  // pdf: las cartas en PDF se suben como imagen para poder ver sus páginas.
  image: 'jpg,jpeg,png,webp,gif,heic,avif,pdf',
  video: 'mp4,mov,webm,m4v',
  raw: 'pdf',
} as const

type UploadKind = keyof typeof FORMATS

function cloudinaryConfig() {
  return {
    cloudName: (process.env.CLOUDINARY_CLOUD_NAME ?? process.env.VITE_CLOUDINARY_CLOUD_NAME ?? '').trim(),
    apiKey: (process.env.CLOUDINARY_API_KEY ?? '').trim(),
    apiSecret: (process.env.CLOUDINARY_API_SECRET ?? '').trim(),
  }
}

/** Firma de Cloudinary: parámetros ordenados `a=1&b=2` + secreto, en SHA-1. */
export function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1').update(toSign + apiSecret).digest('hex')
}

async function uploaderFolder(req: Request): Promise<string> {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = await adminAuth.verifyIdToken(header.slice(7))
      return `adelia/users/${decoded.uid}`
    } catch {
      // Token caducado o falso: se trata como subida sin sesión.
    }
  }
  // Alta de restaurante: aún no hay cuenta. Carpeta aparte y límite estricto (rateLimit.ts).
  return 'adelia/signup'
}

router.post('/cloudinary-signature', async (req: Request, res: Response) => {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig()
  if (!cloudName || !apiKey || !apiSecret) {
    res.json({ enabled: false })
    return
  }

  const kindRaw = String(req.body?.resourceType ?? 'image')
  const kind: UploadKind = kindRaw === 'video' || kindRaw === 'raw' ? kindRaw : 'image'
  const params = {
    allowed_formats: FORMATS[kind],
    folder: await uploaderFolder(req),
    timestamp: Math.floor(Date.now() / 1000),
  }

  res.json({
    enabled: true,
    cloudName,
    apiKey,
    ...params,
    signature: signCloudinaryParams(params, apiSecret),
  })
})

export default router
