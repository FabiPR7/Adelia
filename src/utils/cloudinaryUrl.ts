export interface CloudinaryOptimizeOptions {
  width?: number
  height?: number
  quality?: 'auto' | number
}

/**
 * Applies Cloudinary delivery transforms (WebP/AVIF via f_auto, adaptive quality).
 * Original URL is stored in Firestore; this only affects display.
 */
export function ensureHttpsUrl(url: string): string {
  if (url.startsWith('http://')) {
    return `https://${url.slice('http://'.length)}`
  }
  return url
}

export function optimizeCloudinaryUrl(
  url: string,
  options: CloudinaryOptimizeOptions = {},
): string {
  if (!url) {
    return url
  }

  url = ensureHttpsUrl(url)

  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url
  }

  if (/\/upload\/[^/]*f_auto/.test(url)) {
    return url
  }

  const transforms = ['f_auto', 'q_auto']

  if (options.width) {
    transforms.push(`w_${options.width}`)
  }

  if (options.height) {
    transforms.push(`h_${options.height}`)
  }

  if (options.quality && options.quality !== 'auto') {
    transforms.push(`q_${options.quality}`)
  }

  return url.replace('/upload/', `/upload/${transforms.join(',')}/`)
}

export function optimizeCloudinaryVideoUrl(url: string): string {
  if (!url) {
    return url
  }

  url = resolveCloudinaryVideoUrl(url)

  if (!url.includes('res.cloudinary.com')) {
    return url
  }

  if (url.includes('/video/upload/')) {
    if (/\/video\/upload\/[^/]*f_(mp4|auto)/.test(url)) {
      return url
    }
    return url.replace('/video/upload/', '/video/upload/f_mp4,q_auto,w_720/')
  }

  return url
}

/** Cloudinary a veces guarda el clip en image/ o raw/; el reproductor necesita video/. */
export function resolveCloudinaryVideoUrl(url: string): string {
  const https = ensureHttpsUrl(url.trim())

  if (!https.includes('res.cloudinary.com')) {
    return https
  }

  return https
    .replace('/image/upload/', '/video/upload/')
    .replace('/raw/upload/', '/video/upload/')
}

/** Fotograma inicial en 16:9 para no descargar el vídeo hasta que se reproduzca. */
export function cloudinaryVideoPosterUrl(url: string, width = 900): string {
  if (!url) {
    return ''
  }

  const videoUrl = resolveCloudinaryVideoUrl(url)

  if (!videoUrl.includes('res.cloudinary.com') || !videoUrl.includes('/video/upload/')) {
    return ''
  }

  if (/\/video\/upload\/[^/]*so_0/.test(videoUrl)) {
    return videoUrl
  }

  return videoUrl.replace(
    '/video/upload/',
    `/video/upload/so_0,w_${width},c_fill,g_auto,ar_16:9,q_auto,f_jpg/`,
  )
}

export function canRenderCloudinaryPdfPages(pdfUrl: string): boolean {
  const url = ensureHttpsUrl(pdfUrl)
  return url.includes('res.cloudinary.com') && url.includes('/image/upload/')
}

export function cloudinaryPdfPageUrl(pdfUrl: string, page: number, width = 1400): string {
  const url = ensureHttpsUrl(pdfUrl)
  if (!canRenderCloudinaryPdfPages(url)) {
    return url
  }

  const transform = `pg_${Math.max(1, page)},f_jpg,q_auto,w_${width}`
  if (/\/upload\/[^/]*pg_\d+/.test(url)) {
    return url
  }

  return url.replace('/upload/', `/upload/${transform}/`)
}

export const CLOUDINARY_DISPLAY = {
  logo: { width: 256 },
  photoThumb: { width: 320 },
  photoGallery: { width: 960 },
  photoPreview: { width: 480 },
  menuProductThumb: { width: 160, height: 120 },
  menuProductGrid: { width: 480, height: 360 },
  menuProductList: { width: 640, height: 480 },
  menuProductLightbox: { width: 960 },
} as const satisfies Record<string, CloudinaryOptimizeOptions>
