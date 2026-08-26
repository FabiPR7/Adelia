import { getCompanyMainPhotoUrl, getCompanySecondaryPhotos } from './companyPhotos'

export type CollageItem = {
  type: 'image' | 'video'
  url: string
}

export function orderPhotosForCollage(photos: string[], mainPhotoIndex = 0): string[] {
  const clean = photos.filter(Boolean)
  const main = getCompanyMainPhotoUrl(clean, mainPhotoIndex)
  const rest = getCompanySecondaryPhotos(clean, mainPhotoIndex)
  return main ? [main, ...rest] : rest
}

export function buildCollageSlots(
  photos: string[],
  videos: string[],
  mainPhotoIndex = 0,
  featuredVideoIndex = 0,
): {
  featuredVideo: string | null
  staticSmall: CollageItem[]
  leftovers: CollageItem[]
  tileCount: number
  orderedPhotos: string[]
} {
  const orderedPhotos = orderPhotosForCollage(photos, mainPhotoIndex)
  const clips = videos.filter(Boolean).slice(0, 2)

  if (clips.length === 0) {
    const visible = orderedPhotos.slice(0, 5)
    return {
      featuredVideo: null,
      staticSmall: visible.map((url) => ({ type: 'image', url })),
      leftovers: orderedPhotos.slice(5).map((url) => ({ type: 'image', url })),
      tileCount: visible.length,
      orderedPhotos,
    }
  }

  const safeIndex = ((featuredVideoIndex % clips.length) + clips.length) % clips.length
  const featuredVideo = clips[safeIndex] ?? clips[0] ?? null
  const photoItems: CollageItem[] = orderedPhotos.map((url) => ({ type: 'image', url }))
  const maxSmall = 4
  const needsRotator = photoItems.length > maxSmall
  const staticCount = needsRotator ? maxSmall - 1 : Math.min(maxSmall, photoItems.length)
  const staticSmall = photoItems.slice(0, staticCount)
  const leftovers = photoItems.slice(staticCount)
  const tileCount = 1 + staticSmall.length + (leftovers.length > 0 ? 1 : 0)

  return {
    featuredVideo,
    staticSmall,
    leftovers,
    tileCount,
    orderedPhotos,
  }
}
