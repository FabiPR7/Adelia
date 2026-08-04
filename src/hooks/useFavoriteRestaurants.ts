import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateCustomerFavorites } from '../services/customerAuth'
import { readLocalFavoriteSlugs, toggleFavoriteSlug, writeLocalFavoriteSlugs } from '../utils/favorites'

export function useFavoriteRestaurants() {
  const { user, profile, refreshProfile } = useAuth()
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>(() => readLocalFavoriteSlugs())

  useEffect(() => {
    if (profile?.role === 'customer') {
      setFavoriteSlugs(profile.favoriteSlugs)
      writeLocalFavoriteSlugs(profile.favoriteSlugs)
      return
    }

    setFavoriteSlugs(readLocalFavoriteSlugs())
  }, [profile?.role, profile?.favoriteSlugs])

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
          // Local favorites still work offline.
        }
      }
    },
    [favoriteSlugs, profile?.role, refreshProfile, user],
  )

  const isFavorite = useCallback(
    (slug: string) => favoriteSlugs.includes(slug),
    [favoriteSlugs],
  )

  return {
    favoriteSlugs,
    toggleFavorite,
    isFavorite,
  }
}
