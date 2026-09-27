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
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import CustomerProductTourOverlay from '../components/customerTour/CustomerProductTourOverlay'
import CustomerTourFab from '../components/customerTour/CustomerTourFab'
import ItemReceiveCelebration from '../components/ItemReceiveCelebration'
import { TOUR_STEPS, type TourStepId } from '../customerTour/tourSteps'
import {
  CANCEL_SHIELD_ITEM_ID,
  PRODUCT_TOUR_GRANT_KEY,
  PRODUCT_TOUR_REWARD_ITEM_ID,
  rarityLabel,
  type InventoryRarity,
} from '../data/inventoryItems'
import { claimProductTourReward } from '../services/firestore'
import {
  markCustomerProductTourCompleted,
  readLocalProductTourCompleted,
  writeLocalProductTourCompleted,
} from '../services/customerProductTour'
import { useAuth } from './AuthContext'
import { useCustomerGamificationContext } from './CustomerGamificationContext'

interface CustomerProductTourContextValue {
  active: boolean
  stepId: TourStepId | null
  startTour: () => void
  stopTour: () => void
}

const CustomerProductTourContext = createContext<CustomerProductTourContextValue | null>(null)

/** Cartas de ejemplo para previsualizar cada rareza en el FAB. */
const PREVIEW_ITEMS: Array<{ itemId: string; rarity: InventoryRarity }> = [
  { itemId: PRODUCT_TOUR_REWARD_ITEM_ID, rarity: 'white' },
  { itemId: 'mesa_3', rarity: 'copper' },
  { itemId: 'mesa_5', rarity: 'silver' },
  { itemId: 'mesa_10', rarity: 'gold' },
  { itemId: CANCEL_SHIELD_ITEM_ID, rarity: 'azure' },
]

function isCustomerAppPath(pathname: string): boolean {
  return pathname.startsWith('/app')
}

function isRestaurantLandingPath(pathname: string): boolean {
  return Boolean(matchPath({ path: '/reservar/:slug', end: true }, pathname))
}

function stepById(id: TourStepId) {
  return TOUR_STEPS.find((step) => step.id === id)
}

export function CustomerProductTourProvider({ children }: { children: ReactNode }) {
  const { user, profile, patchProfileProductTour, patchProfileGamification } = useAuth()
  const { enqueueItemGrants } = useCustomerGamificationContext()
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(false)
  const [stepId, setStepId] = useState<TourStepId | null>(null)
  const [rewardOpen, setRewardOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const autoStartedRef = useRef(false)
  const completingRef = useRef(false)

  const stepIndex = stepId ? TOUR_STEPS.findIndex((step) => step.id === stepId) : -1
  const previewEntry = PREVIEW_ITEMS[previewIndex] ?? PREVIEW_ITEMS[0]

  const showPreview = useCallback(() => {
    setPreviewIndex(0)
    setRewardOpen(true)
  }, [])

  const cyclePreview = useCallback((delta: -1 | 1) => {
    setPreviewIndex((current) => (current + delta + PREVIEW_ITEMS.length) % PREVIEW_ITEMS.length)
  }, [])

  const completeTour = useCallback(async () => {
    if (completingRef.current) return
    completingRef.current = true
    setActive(false)
    setStepId(null)

    patchProfileProductTour(true)
    writeLocalProductTourCompleted()

    try {
      if (user?.uid) {
        const result = await claimProductTourReward()
        patchProfileGamification({
          inventory: result.inventory,
          grantedItemKeys: result.grantedItemKeys,
        })
        if (!result.alreadyClaimed && result.grants.length > 0) {
          enqueueItemGrants(result.grants, PRODUCT_TOUR_GRANT_KEY)
        }
      }
    } catch (error) {
      console.error('No se pudo reclamar la recompensa del tutorial:', error)
      try {
        if (user?.uid) {
          await markCustomerProductTourCompleted(user.uid)
        }
      } catch (fallbackError) {
        console.error('No se pudo guardar el tutorial completado:', fallbackError)
      }
    } finally {
      completingRef.current = false
    }
  }, [
    enqueueItemGrants,
    patchProfileGamification,
    patchProfileProductTour,
    user?.uid,
  ])

  const goToStep = useCallback(
    (nextId: TourStepId) => {
      const next = stepById(nextId)
      setStepId(nextId)
      if (next?.route && location.pathname !== next.route) {
        navigate(next.route)
      }
    },
    [location.pathname, navigate],
  )

  const startTour = useCallback(() => {
    setActive(true)
    setStepId('carousel')
    if (location.pathname !== '/app/explorar') {
      navigate('/app/explorar')
    }
  }, [location.pathname, navigate])

  const stopTour = useCallback(() => {
    void completeTour()
  }, [completeTour])

  const goNext = useCallback(() => {
    if (!stepId) return
    const index = TOUR_STEPS.findIndex((step) => step.id === stepId)
    if (index < 0) return

    if (stepId === 'restaurant-back') {
      goToStep('promos-types')
      return
    }

    const next = TOUR_STEPS[index + 1]
    if (!next) {
      void completeTour()
      return
    }
    goToStep(next.id)
  }, [completeTour, goToStep, stepId])

  useEffect(() => {
    if (autoStartedRef.current) return
    if (!user || !profile || profile.role !== 'customer') return
    if (!profile.onboardingCompleted) return
    if (profile.productTourCompleted || readLocalProductTourCompleted()) return
    if (!isCustomerAppPath(location.pathname)) return

    autoStartedRef.current = true
    const timer = window.setTimeout(() => {
      setActive(true)
      setStepId('carousel')
      if (location.pathname !== '/app/explorar') {
        navigate('/app/explorar', { replace: true })
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [location.pathname, navigate, profile, user])

  useEffect(() => {
    if (!active || !stepId) return
    if (stepId === 'carousel' && isRestaurantLandingPath(location.pathname)) {
      setStepId('restaurant-actions')
    }
  }, [active, location.pathname, stepId])

  useEffect(() => {
    if (!active || stepId !== 'restaurant-back') return
    if (isCustomerAppPath(location.pathname)) {
      goToStep('promos-types')
    }
  }, [active, goToStep, location.pathname, stepId])

  useEffect(() => {
    if (!active || !stepId) return
    const step = stepById(stepId)
    if (step?.route && location.pathname !== step.route && !isRestaurantLandingPath(location.pathname)) {
      navigate(step.route)
    }
  }, [active, location.pathname, navigate, stepId])

  const showFab =
    Boolean(user && profile?.role === 'customer' && profile.onboardingCompleted)
    && (isCustomerAppPath(location.pathname) || (active && isRestaurantLandingPath(location.pathname)))
    && !active
    && !rewardOpen

  const value = useMemo(
    () => ({
      active,
      stepId,
      startTour,
      stopTour,
    }),
    [active, startTour, stepId, stopTour],
  )

  return (
    <CustomerProductTourContext.Provider value={value}>
      {children}
      {active && stepId ? (
        <CustomerProductTourOverlay
          stepId={stepId}
          stepIndex={Math.max(0, stepIndex)}
          stepCount={TOUR_STEPS.length}
          onPrimary={goNext}
          onSkip={stopTour}
        />
      ) : null}
      {showFab ? (
        <CustomerTourFab onClick={showPreview} />
      ) : null}
      <ItemReceiveCelebration
        open={rewardOpen}
        itemId={previewEntry.itemId}
        quantity={1}
        title="Así se reciben cartas"
        preview
        onPreviewCycle={cyclePreview}
        previewLabel={`${previewIndex + 1}/${PREVIEW_ITEMS.length} · ${rarityLabel(previewEntry.rarity)}`}
        onDismiss={() => {
          setRewardOpen(false)
        }}
      />
    </CustomerProductTourContext.Provider>
  )
}

export function useCustomerProductTour(): CustomerProductTourContextValue {
  const ctx = useContext(CustomerProductTourContext)
  if (!ctx) {
    throw new Error('useCustomerProductTour debe usarse dentro de CustomerProductTourProvider')
  }
  return ctx
}

export function useCustomerProductTourOptional(): CustomerProductTourContextValue | null {
  return useContext(CustomerProductTourContext)
}
