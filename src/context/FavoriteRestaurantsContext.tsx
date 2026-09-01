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
import {
  fetchCustomerFavoriteSlugs,
  replaceCustomerFavoritesViaApi,
  setCustomerFavoriteViaApi,
} from '../services/customerFavoritesApi'
import {
  clearLocalFavoriteSlugs,
  hasMigratedGuestFavorites,
  markGuestFavoritesMigrated,
  mergeFavoriteSlugs,
  normalizeFavoriteSlug,
  normalizeFavoriteSlugs,
  readLocalFavoriteSlugs,
  sameFavoriteSlugs,
  toggleFavoriteSlug,
  writeLocalFavoriteSlugs,
} from '../utils/favorites'

interface FavoriteRestaurantsValue {
  favoriteSlugs: string[]
  toggleFavorite: (slug: string) => Promise<void>
  isFavorite: (slug: string) => boolean
  isUpdatingFavorite: (slug: string) => boolean
}

const FavoriteRestaurantsContext = createContext<FavoriteRestaurantsValue | null>(null)

export function FavoriteRestaurantsProvider({ children }: { children: ReactNode }) {
  const { user, profile, patchProfileFavorites } = useAuth()
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() => readLocalFavoriteSlugs())
  const favoriteSlugsRef = useRef(favoriteSlugs)
  const pendingSlugsRef = useRef(new Set<string>())
  const [pendingSlugs, setPendingSlugs] = useState<Set<string>>(() => new Set())
  const hydratedUidRef = useRef<string | null>(null)
  const hydrateGenerationRef = useRef(0)

  const applyFavorites = useCallback((next: string[], persistLocal: boolean) => {
    const normalized = normalizeFavoriteSlugs(next)
    favoriteSlugsRef.current = normalized
    setFavoriteSlugs((current) => (sameFavoriteSlugs(current, normalized) ? current : normalized))
    if (persistLocal) {
      writeLocalFavoriteSlugs(normalized)
    }
  }, [])

  useEffect(() => {
    if (profile?.role !== 'customer' || !user) {
      if (hydratedUidRef.current !== null) {
        hydratedUidRef.current = null
        applyFavorites(readLocalFavoriteSlugs(), false)
      }
      return
    }

    if (hydratedUidRef.current === user.uid) {
      return
    }

    const uid = user.uid
    hydratedUidRef.current = uid
    const generation = ++hydrateGenerationRef.current

    const boot = async () => {
      let remote = normalizeFavoriteSlugs(profile.favoriteSlugs ?? [])
      try {
        remote = normalizeFavoriteSlugs(await fetchCustomerFavoriteSlugs())
      } catch {
        // Seguimos con lo del perfil si la API falla.
      }

      if (hydrateGenerationRef.current !== generation || hydratedUidRef.current !== uid) {
        return
      }

      const local = readLocalFavoriteSlugs()
      const shouldMigrate = !hasMigratedGuestFavorites(uid) && local.length > 0
      const next = shouldMigrate ? mergeFavoriteSlugs(remote, local) : remote

      applyFavorites(next, false)
      clearLocalFavoriteSlugs()
      markGuestFavoritesMigrated(uid)
      patchProfileFavorites(next)

      if (shouldMigrate && !sameFavoriteSlugs(next, remote)) {
        try {
          const saved = await replaceCustomerFavoritesViaApi(next)
          if (hydrateGenerationRef.current === generation && hydratedUidRef.current === uid) {
            applyFavorites(saved, false)
            patchProfileFavorites(saved)
          }
        } catch {
          // La UI ya tiene el merge; se reintentará en el próximo toggle.
        }
      }
    }

    void boot()
  }, [applyFavorites, patchProfileFavorites, profile?.favoriteSlugs, profile?.role, user])

  const toggleFavorite = useCallback(
    async (slug: string) => {
      const normalizedSlug = normalizeFavoriteSlug(slug)
      if (!normalizedSlug || pendingSlugsRef.current.has(normalizedSlug)) {
        return
      }

      const loggedInCustomer = Boolean(user && profile?.role === 'customer')
      pendingSlugsRef.current.add(normalizedSlug)
      setPendingSlugs(new Set(pendingSlugsRef.current))

      const previous = favoriteSlugsRef.current
      const next = toggleFavoriteSlug(previous, normalizedSlug)
      const saved = next.includes(normalizedSlug)

      applyFavorites(next, !loggedInCustomer)
      if (loggedInCustomer) {
        patchProfileFavorites(next)
      }

      try {
        if (loggedInCustomer) {
          const confirmed = await setCustomerFavoriteViaApi(normalizedSlug, saved)
          applyFavorites(confirmed, false)
          patchProfileFavorites(confirmed)
        }
      } catch (error) {
        console.error('No se pudo guardar el favorito:', error)
        applyFavorites(previous, !loggedInCustomer)
        if (loggedInCustomer) {
          patchProfileFavorites(previous)
        }
      } finally {
        pendingSlugsRef.current.delete(normalizedSlug)
        setPendingSlugs(new Set(pendingSlugsRef.current))
      }
    },
    [applyFavorites, patchProfileFavorites, profile?.role, user],
  )

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.includes(normalizeFavoriteSlug(slug)),
    [favoriteSlugs],
  )

  const isUpdatingFavorite = useCallback(
    (slug: string) => pendingSlugs.has(normalizeFavoriteSlug(slug)),
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
