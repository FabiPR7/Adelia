import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { setCustomerFavorite, updateCustomerFavorites } from '../services/customerAuth'
import { readLocalFavoriteSlugs, toggleFavoriteSlug, writeLocalFavoriteSlugs } from '../utils/favorites'

interface FavoriteRestaurantsValue {
  favoriteSlugs: string[]
  toggleFavorite: (slug: string) => Promise<void>
  isFavorite: (slug: string) => boolean
  isUpdatingFavorite: (slug: string) => boolean
}

const FavoriteRestaurantsContext = createContext<FavoriteRestaurantsValue | null>(null)

function sameSlugs(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  const rightSet = new Set(right)
  return left.every((slug) => rightSet.has(slug))
}

export function FavoriteRestaurantsProvider({ children }: { children: ReactNode }) {
  const { user, profile, patchProfileFavorites } = useAuth()
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() => readLocalFavoriteSlugs())
  const favoriteSlugsRef = useRef(favoriteSlugs)
  const pendingSlugsRef = useRef(new Set<string>())
  const [pendingSlugs, setPendingSlugs] = useState<Set<string>>(() => new Set())

  const applyFavoritesLocally = useCallback((next: string[]) => {
    favoriteSlugsRef.current = next
    setFavoriteSlugs((current) => sameSlugs(current, next) ? current : next)
    writeLocalFavoriteSlugs(next)
  }, [])

  useEffect(() => {
    if (profile?.role !== 'customer' || !user) {
      const local = readLocalFavoriteSlugs()
      favoriteSlugsRef.current = local
      setFavoriteSlugs((current) => sameSlugs(current, local) ? current : local)
      return
    }

    const local = readLocalFavoriteSlugs()
    const remote = profile.favoriteSlugs ?? []
    const merged = [...new Set([...remote, ...local])]
    applyFavoritesLocally(merged)

    if (!sameSlugs(merged, remote)) {
      patchProfileFavorites(merged)
      void updateCustomerFavorites(user.uid, merged)
        .catch(() => undefined)
    }
  }, [applyFavoritesLocally, patchProfileFavorites, profile?.favoriteSlugs, profile?.role, user])

  const toggleFavorite = useCallback(
    async (slug: string) => {
      const normalizedSlug = slug.trim()
      if (!normalizedSlug || pendingSlugsRef.current.has(normalizedSlug)) {
        return
      }

      pendingSlugsRef.current.add(normalizedSlug)
      setPendingSlugs(new Set(pendingSlugsRef.current))

      const next = toggleFavoriteSlug(favoriteSlugsRef.current, normalizedSlug)
      const saved = next.includes(normalizedSlug)
      applyFavoritesLocally(next)
      patchProfileFavorites(next)

      try {
        if (user && profile?.role === 'customer') {
          await setCustomerFavorite(user.uid, normalizedSlug, saved)
        }
      } catch {
        // Los favoritos locales siguen valiendo sin red.
      } finally {
        pendingSlugsRef.current.delete(normalizedSlug)
        setPendingSlugs(new Set(pendingSlugsRef.current))
      }
    },
    [applyFavoritesLocally, patchProfileFavorites, profile?.role, user],
  )

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.includes(slug),
    [favoriteSlugs],
  )

  const isUpdatingFavorite = useCallback(
    (slug: string) => pendingSlugs.has(slug),
    [pendingSlugs],
  )

  const value = useMemo(
    () => ({ favoriteSlugs, toggleFavorite, isFavorite, isUpdatingFavorite }),
    [favoriteSlugs, isFavorite, isUpdatingFavorite, toggleFavorite],
  )

  return (
    <FavoriteRestaurantsContext.Provider value={value}>
      {children}
    </FavoriteRestaurantsContext.Provider>
  )
}

export function useFavoriteRestaurants() {
  const context = useContext(FavoriteRestaurantsContext)

  if (!context) {
    throw new Error('useFavoriteRestaurants debe usarse dentro de FavoriteRestaurantsProvider')
  }

  return context
}
