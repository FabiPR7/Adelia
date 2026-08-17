import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { updateCustomerFavorites } from '../services/customerAuth'
import { readLocalFavoriteSlugs, toggleFavoriteSlug, writeLocalFavoriteSlugs } from '../utils/favorites'

interface FavoriteRestaurantsValue {
  favoriteSlugs: string[]
  toggleFavorite: (slug: string) => Promise<void>
  isFavorite: (slug: string) => boolean
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
  const { user, profile, refreshProfile } = useAuth()
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() => readLocalFavoriteSlugs())

  useEffect(() => {
    if (profile?.role !== 'customer' || !user) {
      setFavoriteSlugs(readLocalFavoriteSlugs())
      return
    }

    const local = readLocalFavoriteSlugs()
    const remote = profile.favoriteSlugs ?? []
    const merged = [...new Set([...remote, ...local])]
    setFavoriteSlugs(merged)
    writeLocalFavoriteSlugs(merged)

    if (!sameSlugs(merged, remote)) {
      void updateCustomerFavorites(user.uid, merged)
        .then(() => refreshProfile())
        .catch(() => undefined)
    }
  }, [profile?.favoriteSlugs, profile?.role, refreshProfile, user])

  const toggleFavorite = useCallback(
    async (slug: string) => {
      const next = toggleFavoriteSlug(favoriteSlugs, slug)
      setFavoriteSlugs(next)
      writeLocalFavoriteSlugs(next)

      if (user && profile?.role === 'customer') {
        try {
          await updateCustomerFavorites(user.uid, next)
          await refreshProfile()
        } catch {
          // Los favoritos locales siguen valiendo sin red.
        }
      }
    },
    [favoriteSlugs, profile?.role, refreshProfile, user],
  )

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.includes(slug),
    [favoriteSlugs],
  )

  const value = useMemo(
    () => ({ favoriteSlugs, toggleFavorite, isFavorite }),
    [favoriteSlugs, isFavorite, toggleFavorite],
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
