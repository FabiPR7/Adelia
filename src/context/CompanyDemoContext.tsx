import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import {
  enterCompanyDemoSession,
  getDemoAuthUser,
  getDemoCompany,
  getDemoProfile,
  leaveCompanyDemoSession,
} from '../data/companyPanelDemo'

const CompanyDemoFlagContext = createContext(false)

export function useCompanyDemo() {
  return useContext(CompanyDemoFlagContext)
}

export function DemoCompanyAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    enterCompanyDemoSession()
    return () => leaveCompanyDemoSession()
  }, [])

  const value = useMemo(
    () => ({
      user: getDemoAuthUser(),
      profile: getDemoProfile(),
      company: getDemoCompany(),
      isLoading: false,
      catalogReady: true,
      refreshProfile: async () => undefined,
      refreshCompany: async () => undefined,
      patchProfileGamification: () => undefined,
      patchProfileFavorites: () => undefined,
    }),
    [],
  )

  return (
    <CompanyDemoFlagContext.Provider value={true}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </CompanyDemoFlagContext.Provider>
  )
}
