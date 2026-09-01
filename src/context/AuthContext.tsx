import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '../config/firebase'
import { getCompanyById, getCompanyCredentialsMustChange, getUserProfile } from '../services/firestore'
import { loadGameCatalog } from '../services/gameCatalog'
import { resolveMustChangePassword } from '../utils/authProfile'
import type { AppUser, Company } from '../types'

export interface AuthContextValue {
  user: User | null
  profile: AppUser | null
  company: Company | null
  isLoading: boolean
  catalogReady: boolean
  refreshProfile: () => Promise<void>
  refreshCompany: () => Promise<void>
  patchProfileGamification: (patch: Partial<AppUser['gamification']>) => void
  patchProfileFavorites: (favoriteSlugs: string[]) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null)
      setCompany(null)
      return
    }

    const userProfile = await getUserProfile(currentUser.uid)

    if (!userProfile) {
      setProfile(null)
      setCompany(null)
      return
    }

    if (userProfile.blocked) {
      await signOut(auth)
      setProfile(null)
      setCompany(null)
      return
    }

    const [credentialsMustChange, companyData] = await Promise.all([
      userProfile.companyId
        ? getCompanyCredentialsMustChange(userProfile.companyId).catch(() => null)
        : Promise.resolve(null),
      userProfile.companyId
        ? getCompanyById(userProfile.companyId, {
            includePrivateOps: userProfile.role === 'company',
          }).catch(() => null)
        : Promise.resolve(null),
    ])

    const resolvedProfile = await resolveMustChangePassword(
      currentUser,
      userProfile,
      credentialsMustChange,
    )
    // Los favoritos los posee FavoriteRestaurantsProvider; un refresh no debe
    // pisar un toggle optimista con datos viejos del servidor.
    setProfile((previous) => {
      if (
        previous?.role === 'customer'
        && resolvedProfile.role === 'customer'
        && Array.isArray(previous.favoriteSlugs)
      ) {
        return {
          ...resolvedProfile,
          favoriteSlugs: previous.favoriteSlugs,
        }
      }
      return resolvedProfile
    })
    setCompany(companyData)
  }, [])

  const refreshCompany = useCallback(async () => {
    const companyId = profile?.companyId

    if (!companyId) {
      setCompany(null)
      return
    }

    const companyData = await getCompanyById(companyId)
    setCompany(companyData)
  }, [profile?.companyId])

  const refreshProfile = useCallback(async () => {
    await loadProfile(auth.currentUser)
  }, [loadProfile])

  const patchProfileGamification = useCallback((patch: Partial<AppUser['gamification']>) => {
    setProfile((current) => {
      if (!current || current.role !== 'customer') {
        return current
      }

      return {
        ...current,
        gamification: {
          ...current.gamification,
          ...patch,
        },
      }
    })
  }, [])

  const patchProfileFavorites = useCallback((favoriteSlugs: string[]) => {
    setProfile((current) => {
      if (!current || current.role !== 'customer') {
        return current
      }

      return {
        ...current,
        favoriteSlugs,
      }
    })
  }, [])

  useEffect(() => {
    if (profile?.role !== 'customer') {
      return
    }
    void loadGameCatalog()
  }, [profile?.role])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      try {
        await loadProfile(currentUser)
      } catch {
        setProfile(null)
        setCompany(null)
      }
      setIsLoading(false)
    })

    return unsubscribe
  }, [loadProfile])

  const value = useMemo(
    () => ({
      user,
      profile,
      company,
      isLoading,
      catalogReady: true,
      refreshProfile,
      refreshCompany,
      patchProfileGamification,
      patchProfileFavorites,
    }),
    [
      user,
      profile,
      company,
      isLoading,
      refreshProfile,
      refreshCompany,
      patchProfileGamification,
      patchProfileFavorites,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }

  return context
}
