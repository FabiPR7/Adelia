const STORAGE_KEY = 'adelia_favorite_slugs'

export function readLocalFavoriteSlugs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function writeLocalFavoriteSlugs(slugs: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs))
}

export function toggleFavoriteSlug(slugs: string[], slug: string): string[] {
  if (slugs.includes(slug)) {
    return slugs.filter((item) => item !== slug)
  }

  return [...slugs, slug]
}
