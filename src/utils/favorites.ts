const STORAGE_KEY = 'adelia_favorite_slugs'
const MIGRATED_PREFIX = 'adelia_favorites_migrated:'

export function normalizeFavoriteSlug(slug: string): string {
  return slug.trim().toLowerCase()
}

export function normalizeFavoriteSlugs(slugs: unknown): string[] {
  if (!Array.isArray(slugs)) {
    return []
  }

  const next: string[] = []
  const seen = new Set<string>()
  for (const item of slugs) {
    if (typeof item !== 'string') {
      continue
    }
    const slug = normalizeFavoriteSlug(item)
    if (!slug || seen.has(slug)) {
      continue
    }
    seen.add(slug)
    next.push(slug)
  }
  return next
}

export function readLocalFavoriteSlugs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    return normalizeFavoriteSlugs(parsed)
  } catch {
    return []
  }
}

export function writeLocalFavoriteSlugs(slugs: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeFavoriteSlugs(slugs)))
}

export function clearLocalFavoriteSlugs(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasMigratedGuestFavorites(uid: string): boolean {
  try {
    return localStorage.getItem(`${MIGRATED_PREFIX}${uid}`) === '1'
  } catch {
    return true
  }
}

export function markGuestFavoritesMigrated(uid: string): void {
  try {
    localStorage.setItem(`${MIGRATED_PREFIX}${uid}`, '1')
  } catch {
    // private mode / blocked storage
  }
}

/** Une listas sin duplicados; útil solo en la migración guest → cuenta. */
export function mergeFavoriteSlugs(remote: string[], local: string[]): string[] {
  return normalizeFavoriteSlugs([...remote, ...local])
}

export function toggleFavoriteSlug(slugs: string[], slug: string): string[] {
  const normalizedSlug = normalizeFavoriteSlug(slug)
  if (!normalizedSlug) {
    return normalizeFavoriteSlugs(slugs)
  }

  const current = normalizeFavoriteSlugs(slugs)
  if (current.includes(normalizedSlug)) {
    return current.filter((item) => item !== normalizedSlug)
  }

  return [...current, normalizedSlug]
}

export function sameFavoriteSlugs(left: string[], right: string[]): boolean {
  const a = normalizeFavoriteSlugs(left)
  const b = normalizeFavoriteSlugs(right)
  if (a.length !== b.length) {
    return false
  }
  const rightSet = new Set(b)
  return a.every((slug) => rightSet.has(slug))
}
