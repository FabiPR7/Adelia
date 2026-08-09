export function normalizeMainPhotoIndex(index: number, photosLength: number): number {
  if (photosLength <= 0) {
    return 0
  }

  if (!Number.isFinite(index) || index < 0 || index >= photosLength) {
    return 0
  }

  return index
}

export function adjustMainPhotoIndexAfterRemove(
  mainIndex: number,
  removedIndex: number,
  newLength: number,
): number {
  if (newLength <= 0) {
    return 0
  }

  if (removedIndex === mainIndex) {
    return 0
  }

  if (removedIndex < mainIndex) {
    return mainIndex - 1
  }

  return mainIndex
}

export function getCompanyMainPhotoUrl(photos: string[], mainPhotoIndex = 0): string | null {
  if (photos.length === 0) {
    return null
  }

  const index = normalizeMainPhotoIndex(mainPhotoIndex, photos.length)
  return photos[index] ?? photos[0]
}

export function getCompanySecondaryPhotos(photos: string[], mainPhotoIndex = 0): string[] {
  if (photos.length <= 1) {
    return []
  }

  const index = normalizeMainPhotoIndex(mainPhotoIndex, photos.length)
  return photos.filter((_, photoIndex) => photoIndex !== index)
}
