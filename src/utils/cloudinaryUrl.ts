export interface CloudinaryOptimizeOptions {
  width?: number
  height?: number
  quality?: 'auto' | number
}

/**
 * Applies Cloudinary delivery transforms (WebP/AVIF via f_auto, adaptive quality).
 * Original URL is stored in Firestore; this only affects display.
 */
export function optimizeCloudinaryUrl(
  url: string,
  options: CloudinaryOptimizeOptions = {},
): string {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
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

export const CLOUDINARY_DISPLAY = {
  logo: { width: 256 },
  photoThumb: { width: 320 },
  photoGallery: { width: 960 },
  photoPreview: { width: 480 },
} as const satisfies Record<string, CloudinaryOptimizeOptions>
