/**
 * Performance Monitoring - Firebase Performance
 * 
 * Monitorea:
 * - Tiempos de carga de páginas
 * - Latencia de API calls
 * - Tiempos de queries Firestore
 * - Performance de operaciones críticas
 */

// Lazy load para evitar impacto en bundle size
let perf: any = null

/**
 * Inicializa Firebase Performance (lazy)
 */
async function getPerformance() {
  if (perf) return perf

  try {
    const { getPerformance: initPerf } = await import('firebase/performance')
    const { initializeApp, getApps } = await import('firebase/app')

    let app
    const apps = getApps()
    if (apps.length === 0) {
      // Firebase no inicializado, crear app
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      }
      app = initializeApp(firebaseConfig)
    } else {
      app = apps[0]
    }

    perf = initPerf(app)
    return perf
  } catch (error) {
    console.warn('Firebase Performance not available:', error)
    return null
  }
}

/**
 * Trace para medir operaciones
 */
export class PerformanceTrace {
  private traceName: string
  private trace: any = null
  private startTime: number = 0

  constructor(traceName: string) {
    this.traceName = traceName
  }

  /**
   * Inicia el trace
   */
  async start() {
    this.startTime = performance.now()

    try {
      const perf = await getPerformance()
      if (perf) {
        this.trace = perf.trace(this.traceName)
        this.trace.start()
      }
    } catch (error) {
      console.warn('Failed to start trace:', error)
    }
  }

  /**
   * Añade un atributo custom al trace
   */
  setAttribute(name: string, value: string) {
    try {
      if (this.trace) {
        this.trace.putAttribute(name, value)
      }
    } catch (error) {
      console.warn('Failed to set attribute:', error)
    }
  }

  /**
   * Añade una métrica custom al trace
   */
  setMetric(name: string, value: number) {
    try {
      if (this.trace) {
        this.trace.putMetric(name, value)
      }
    } catch (error) {
      console.warn('Failed to set metric:', error)
    }
  }

  /**
   * Detiene el trace
   */
  async stop() {
    const elapsed = performance.now() - this.startTime

    try {
      if (this.trace) {
        this.trace.stop()
      }
    } catch (error) {
      console.warn('Failed to stop trace:', error)
    }

    // Log en development
    if (import.meta.env.DEV) {
      console.log(`⏱️ [${this.traceName}] ${elapsed.toFixed(2)}ms`)
    }

    return elapsed
  }

  /**
   * Incrementa un contador
   */
  incrementMetric(name: string, incrementBy: number = 1) {
    try {
      if (this.trace) {
        this.trace.incrementMetric(name, incrementBy)
      }
    } catch (error) {
      console.warn('Failed to increment metric:', error)
    }
  }
}

/**
 * Helper para medir operaciones con callback
 * 
 * @example
 * const result = await measurePerformance('fetch_companies', async () => {
 *   return await fetchCompanies()
 * }, { city: 'Madrid' })
 */
export async function measurePerformance<T>(
  traceName: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string>
): Promise<T> {
  const trace = new PerformanceTrace(traceName)

  await trace.start()

  // Añadir atributos si existen
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      trace.setAttribute(key, value)
    })
  }

  try {
    const result = await operation()
    await trace.stop()
    return result
  } catch (error) {
    trace.setAttribute('error', 'true')
    await trace.stop()
    throw error
  }
}

/**
 * Medición de API calls
 */
export async function measureApiCall<T>(
  endpoint: string,
  method: string,
  call: () => Promise<T>
): Promise<T> {
  return measurePerformance(`api_${endpoint}`, call, {
    method,
    endpoint,
  })
}

/**
 * Medición de queries Firestore
 */
export async function measureFirestoreQuery<T>(
  collection: string,
  operation: () => Promise<T>
): Promise<T> {
  return measurePerformance(`firestore_${collection}`, operation, {
    collection,
  })
}

/**
 * Traces predefinidos para operaciones comunes
 */
export const TRACES = {
  // Autenticación
  LOGIN: 'auth_login',
  REGISTER: 'auth_register',
  LOGOUT: 'auth_logout',

  // Reservas
  CREATE_RESERVATION: 'reservation_create',
  CANCEL_RESERVATION: 'reservation_cancel',
  CHECK_AVAILABILITY: 'reservation_check',

  // Empresas
  FETCH_COMPANIES: 'companies_fetch',
  FETCH_COMPANY_DETAILS: 'company_details',
  CREATE_COMPANY: 'company_create',

  // Reviews
  FETCH_REVIEWS: 'reviews_fetch',
  CREATE_REVIEW: 'review_create',

  // Analytics
  FETCH_ANALYTICS: 'analytics_fetch',
  EXPORT_DATA: 'analytics_export',

  // Gamification
  CLAIM_PROMOTION: 'gamification_claim',
  UPDATE_XP: 'gamification_xp',

  // Upload
  UPLOAD_IMAGE: 'upload_image',
} as const

/**
 * Medir tiempo de carga de página
 */
export function measurePageLoad(pageName: string) {
  // Usar Navigation Timing API
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

    if (navigation) {
      const loadTime = navigation.loadEventEnd - navigation.fetchStart
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart
      const firstPaint = performance.getEntriesByType('paint')
        .find(entry => entry.name === 'first-contentful-paint')

      console.log(`📊 Page Load [${pageName}]:`, {
        loadTime: `${loadTime.toFixed(2)}ms`,
        domContentLoaded: `${domContentLoaded.toFixed(2)}ms`,
        firstPaint: firstPaint ? `${(firstPaint.startTime).toFixed(2)}ms` : 'N/A',
      })
    }
  }
}

/**
 * Hook de React para medir performance de componentes
 */
export function usePerformanceTrace(traceName: string) {
  const trace = new PerformanceTrace(traceName)

  // Start on mount
  React.useEffect(() => {
    trace.start()

    return () => {
      trace.stop()
    }
  }, [])

  return trace
}

// Hack para importar React solo si está disponible
declare const React: any

/**
 * Alerta si una operación es muy lenta
 */
export function alertIfSlow(operation: string, durationMs: number, thresholdMs: number = 3000) {
  if (durationMs > thresholdMs) {
    console.warn(`🐌 SLOW OPERATION: ${operation} took ${durationMs.toFixed(2)}ms (threshold: ${thresholdMs}ms)`)

    // En desarrollo, mostrar notificación
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      console.error(`⚠️ ${operation} is slow!`)
    }
  }
}

/**
 * Wrapper para automatic tracing
 */
export function traced(traceName: string) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      return await measurePerformance(
        `${traceName}_${propertyKey}`,
        () => originalMethod.apply(this, args)
      )
    }

    return descriptor
  }
}

/**
 * Exportar métricas custom a Firebase Analytics
 */
export async function logCustomMetric(
  metricName: string,
  value: number,
  attributes?: Record<string, string>
) {
  try {
    const { getAnalytics, logEvent } = await import('firebase/analytics')
    const analytics = getAnalytics()

    logEvent(analytics, metricName, {
      value,
      ...attributes,
    })
  } catch (error) {
    console.warn('Failed to log custom metric:', error)
  }
}
