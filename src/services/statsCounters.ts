/**
 * Servicio optimizado para leer contadores agregados
 * Reemplaza queries costosas que leían colecciones completas
 */

import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

export interface StatsCounters {
  totalUsers: number
  totalCustomers: number
  totalCompanyUsers: number
  totalCompanies: number
  totalReservations: number
  totalReviews: number
  lastUpdated: Date | null
}

// Cache en memoria (5 minutos TTL)
let cachedStats: StatsCounters | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Obtiene los contadores agregados desde Firestore
 * Usa cache en memoria para reducir lecturas
 */
export async function getStatsCounters(forceRefresh = false): Promise<StatsCounters> {
  const now = Date.now()

  // Retornar cache si es válido y no se fuerza refresh
  if (!forceRefresh && cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedStats
  }

  try {
    const statsDoc = await getDoc(doc(db, 'stats', 'counters'))

    if (!statsDoc.exists()) {
      // Si no existe el documento, retornar valores por defecto
      console.warn('⚠️ Documento stats/counters no existe. Ejecuta recalculateAllCounters.')
      return {
        totalUsers: 0,
        totalCustomers: 0,
        totalCompanyUsers: 0,
        totalCompanies: 0,
        totalReservations: 0,
        totalReviews: 0,
        lastUpdated: null,
      }
    }

    const data = statsDoc.data()

    const stats: StatsCounters = {
      totalUsers: typeof data.totalUsers === 'number' ? data.totalUsers : 0,
      totalCustomers: typeof data.totalCustomers === 'number' ? data.totalCustomers : 0,
      totalCompanyUsers: typeof data.totalCompanyUsers === 'number' ? data.totalCompanyUsers : 0,
      totalCompanies: typeof data.totalCompanies === 'number' ? data.totalCompanies : 0,
      totalReservations: typeof data.totalReservations === 'number' ? data.totalReservations : 0,
      totalReviews: typeof data.totalReviews === 'number' ? data.totalReviews : 0,
      lastUpdated: data.lastUpdated?.toDate?.() ?? null,
    }

    // Actualizar cache
    cachedStats = stats
    cacheTimestamp = now

    return stats
  } catch (error) {
    console.error('❌ Error obteniendo stats counters:', error)

    // Si hay error pero tenemos cache, retornar cache aunque esté expirado
    if (cachedStats) {
      console.warn('⚠️ Usando cache expirado debido a error')
      return cachedStats
    }

    // Si no hay cache, retornar valores por defecto
    return {
      totalUsers: 0,
      totalCustomers: 0,
      totalCompanyUsers: 0,
      totalCompanies: 0,
      totalReservations: 0,
      totalReviews: 0,
      lastUpdated: null,
    }
  }
}

/**
 * Limpia el cache forzando a recargar en la próxima llamada
 */
export function clearStatsCache(): void {
  cachedStats = null
  cacheTimestamp = 0
}
