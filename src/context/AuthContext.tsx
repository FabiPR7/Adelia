import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../config/firebase'
import { getCompanyById, getCompanyCredentialsMustChange, getUserProfile } from '../services/firestore'
import { resolveMustChangePassword } from '../utils/authProfile'
import type { AppUser, Company } from '../types'

interface AuthContextValue {
  user: User | null
  profile: AppUser | null
  company: Company | null
  isLoading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

    const credentialsMustChange = userProfile.companyId
      ? await getCompanyCredentialsMustChange(userProfile.companyId)
      : null

    const resolvedProfile = await resolveMustChangePassword(
      currentUser,
      userProfile,
      credentialsMustChange,
    )
    setProfile(resolvedProfile)

    if (resolvedProfile.companyId) {
      const companyData = await getCompanyById(resolvedProfile.companyId)
      setCompany(companyData)
      return
    }

    setCompany(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(auth.currentUser)
  }, [loadProfile])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      await loadProfile(currentUser)
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
      refreshProfile,
    }),
    [user, profile, company, isLoading, refreshProfile],
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
