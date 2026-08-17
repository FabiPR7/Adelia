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

  url = ensureHttpsUrl(url)

  if (!url.includes('res.cloudinary.com')) {
    return url
  }

  if (url.includes('/video/upload/')) {
    if (/\/video\/upload\/[^/]*f_auto/.test(url)) {
      return url
    }
    return url.replace('/video/upload/', '/video/upload/f_auto,q_auto,w_720/')
  }

  return optimizeCloudinaryUrl(url, { width: 720 })
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
