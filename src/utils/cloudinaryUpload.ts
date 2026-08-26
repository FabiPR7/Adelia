const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

export type CloudinaryResourceType = 'image' | 'video'

export const CLOUDINARY_CHUNK_SIZE = 6 * 1024 * 1024
export const CLOUDINARY_CHUNK_THRESHOLD = 8 * 1024 * 1024
const CLOUDINARY_REQUEST_TIMEOUT_MS = 90_000

export interface CloudinaryUploadOptions {
  onProgress?: (percent: number) => void
}

function assertCloudinaryConfig() {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Faltan VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET en .env.local',
    )
  }
}

export function cloudinaryUploadEndpoint(
  resourceType: CloudinaryResourceType | 'raw' | 'auto',
  cloudName = CLOUD_NAME,
): string {
  return `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`
}

export function shouldUseChunkedCloudinaryUpload(
  fileSize: number,
  resourceType: CloudinaryResourceType | 'raw' | 'auto',
): boolean {
  return resourceType === 'video' && fileSize >= CLOUDINARY_CHUNK_THRESHOLD
}

export function cloudinaryByteRanges(
  fileSize: number,
  chunkSize = CLOUDINARY_CHUNK_SIZE,
): Array<{ start: number; endExclusive: number }> {
  if (fileSize <= 0 || chunkSize <= 0) {
    return []
  }

  const ranges: Array<{ start: number; endExclusive: number }> = []
  let start = 0

  while (start < fileSize) {
    const endExclusive = Math.min(start + chunkSize, fileSize)
    ranges.push({ start, endExclusive })
    start = endExclusive
  }

  return ranges
}

export function formatCloudinaryUploadError(error: unknown, resourceType: CloudinaryResourceType | 'raw' | 'auto'): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const normalized = raw.toLowerCase()

  if (
    normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('load failed')
    || normalized.includes('network request failed')
  ) {
    return resourceType === 'video'
      ? 'No se pudo subir el vídeo. Suele pasar si pesa demasiado, se corta la conexión o Cloudinary no admite vídeos en el preset. Usa un clip de hasta 30 s y 40 MB.'
      : 'No se pudo subir el archivo. Revisa la conexión e inténtalo de nuevo.'
  }

  if (normalized.includes('timeout') || normalized.includes('tiempo de espera')) {
    return 'La subida ha tardado demasiado. Prueba un vídeo más corto o una conexión más estable.'
  }

  if (normalized.includes('file size too large') || normalized.includes('maximum is')) {
    return 'Cloudinary ha rechazado el archivo por tamaño. Recórtalo o expórtalo en HD (720p).'
  }

  if (normalized.includes('upload preset') || normalized.includes('unsigned')) {
    return 'El preset de Cloudinary no permite esta subida. En el dashboard, el preset unsigned debe admitir vídeos.'
  }

  if (normalized.includes('invalid image') || normalized.includes('resource type')) {
    return 'Este preset de Cloudinary parece estar limitado a imágenes. Activa la subida de vídeos en el unsigned preset.'
  }

  return raw.trim() || 'No se pudo subir el archivo.'
}

interface CloudinaryUploadResult {
  secure_url: string
  pages?: number
}

interface CloudinaryJson {
  secure_url?: string
  pages?: number
  error?: { message?: string }
}

function parseCloudinaryResponse(
  status: number,
  responseText: string,
  requireSecureUrl = true,
): CloudinaryUploadResult | null {
  let data: CloudinaryJson = {}

  try {
    data = JSON.parse(responseText) as CloudinaryJson
  } catch {
    if (!responseText && status >= 200 && status < 300 && !requireSecureUrl) {
      return null
    }
    throw new Error(status >= 400 ? 'No se pudo subir el archivo.' : 'Respuesta inválida del servidor de medios.')
  }

  if (status < 200 || status >= 300) {
    throw new Error(data.error?.message ?? 'No se pudo subir el archivo.')
  }

  if (!data.secure_url) {
    if (requireSecureUrl) {
      throw new Error(data.error?.message ?? 'No se pudo subir el archivo.')
    }
    return null
  }

  return {
    secure_url: data.secure_url,
    pages: typeof data.pages === 'number' ? data.pages : undefined,
  }
}

function postCloudinaryForm(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void,
  requireSecureUrl = true,
): Promise<CloudinaryUploadResult | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = CLOUDINARY_REQUEST_TIMEOUT_MS

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded, event.total)
      }
    }

    xhr.onload = () => {
      try {
        resolve(parseCloudinaryResponse(xhr.status, xhr.responseText, requireSecureUrl))
      } catch (error) {
        reject(error)
      }
    }

    xhr.onerror = () => {
      reject(new TypeError('Failed to fetch'))
    }

    xhr.ontimeout = () => {
      reject(new Error('Tiempo de espera agotado al subir el archivo.'))
    }

    xhr.send(formData)
  })
}

function appendUploadFields(formData: FormData, file: Blob, fileName: string) {
  formData.append('file', file, fileName)
  formData.append('upload_preset', UPLOAD_PRESET!)
}

async function uploadCloudinarySingle(
  file: File,
  resourceType: CloudinaryResourceType | 'raw' | 'auto',
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData()
  appendUploadFields(formData, file, file.name)

  return postCloudinaryForm(
    cloudinaryUploadEndpoint(resourceType),
    formData,
    {},
    (loaded, total) => {
      if (total > 0) {
        onProgress?.(Math.min(99, Math.round((loaded / total) * 100)))
      }
    },
  ).then((result) => {
    if (!result) {
      throw new Error('No se pudo subir el archivo.')
    }
    return result
  })
}

async function uploadCloudinaryChunked(
  file: File,
  resourceType: CloudinaryResourceType | 'raw' | 'auto',
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const ranges = cloudinaryByteRanges(file.size)
  const uniqueUploadId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
  let lastResult: CloudinaryUploadResult | null = null

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index]
    const isLast = index === ranges.length - 1
    const chunk = file.slice(range.start, range.endExclusive)
    const formData = new FormData()
    appendUploadFields(formData, chunk, file.name)

    const result = await postCloudinaryForm(
      cloudinaryUploadEndpoint(resourceType),
      formData,
      {
        'X-Unique-Upload-Id': uniqueUploadId,
        'Content-Range': `bytes ${range.start}-${range.endExclusive - 1}/${file.size}`,
      },
      (loaded, total) => {
        const chunkWeight = 1 / ranges.length
        const chunkFraction = total > 0 ? loaded / total : 0
        onProgress?.(Math.min(99, Math.round(((index + chunkFraction) * chunkWeight) * 100)))
      },
      isLast,
    )

    if (result) {
      lastResult = result
    }
  }

  if (!lastResult) {
    throw new Error('No se pudo subir el archivo.')
  }

  return lastResult
}

async function uploadCloudinaryResource(
  file: File,
  resourceType: CloudinaryResourceType | 'raw' | 'auto',
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  assertCloudinaryConfig()

  const uploader = shouldUseChunkedCloudinaryUpload(file.size, resourceType)
    ? uploadCloudinaryChunked
    : uploadCloudinarySingle

  try {
    const result = await uploader(file, resourceType, onProgress)
    onProgress?.(100)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const isNetwork = /failed to fetch|networkerror|load failed/i.test(message)

    if (resourceType === 'video' && isNetwork) {
      try {
        const fallback = await uploadCloudinarySingle(file, 'auto', onProgress)
        onProgress?.(100)
        return fallback
      } catch {
        throw new Error(formatCloudinaryUploadError(error, resourceType))
      }
    }

    throw new Error(formatCloudinaryUploadError(error, resourceType))
  }
}

export async function uploadToCloudinary(
  file: File,
  resourceType: CloudinaryResourceType,
  options: CloudinaryUploadOptions = {},
): Promise<string> {
  const data = await uploadCloudinaryResource(file, resourceType, options.onProgress)
  return data.secure_url
}

export async function uploadPdfToCloudinary(file: File): Promise<{
  url: string
  pages: number
  fileName: string
}> {
  try {
    const data = await uploadCloudinaryResource(file, 'image')
    return {
      url: data.secure_url,
      pages: data.pages && data.pages > 0 ? data.pages : 0,
      fileName: file.name,
    }
  } catch {
    const data = await uploadCloudinaryResource(file, 'raw')
    return {
      url: data.secure_url,
      pages: 0,
      fileName: file.name,
    }
  }
}

export function getCloudinaryResourceType(file: File): CloudinaryResourceType | null {
  if (file.type.startsWith('image/')) {
    return 'image'
  }

  if (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
    return 'video'
  }

  return null
}
