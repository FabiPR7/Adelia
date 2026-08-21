/**
 * Servicio de Analytics Financieros para Admin Dashboard
 * Incluye métricas de pagos, fianzas, revenue, transacciones, etc.
 */

import { collection, getDocs, query, where, Timestamp, limit as firestoreLimit } from 'firebase/firestore'
import { db } from '../config/firebase'
// import { getStatsCounters } from './statsCounters'

export interface FinancialStats {
  totalRevenue: number
  totalDeposits: number
  totalRefunds: number
  totalPendingPayments: number
  averageReservationValue: number
  monthlyRecurringRevenue: number
  totalTransactions: number
  successfulPayments: number
  failedPayments: number
  conversionRate: number
}

export interface RevenueByPeriod {
  labels: string[]
  revenue: number[]
  deposits: number[]
  refunds: number[]
}

export interface TopCompanyByRevenue {
  companyId: string
  companyName: string
  totalRevenue: number
  totalReservations: number
  averageValue: number
}

export interface PaymentMethodStats {
  method: string
  count: number
  totalAmount: number
  percentage: number
}

export interface DepositStats {
  totalCollected: number
  totalRefunded: number
  totalPending: number
  averageDepositAmount: number
  depositSuccessRate: number
}

/**
 * Obtiene estadísticas financieras generales
 * 🚀 OPTIMIZADO: Usa contadores agregados + queries limitadas
 */
export async function getFinancialStats(): Promise<FinancialStats> {
  try {
    // const counters = await getStatsCounters()

    // Query limitada de reservas recientes con pagos
    const now = new Date()
    const monthAgo = new Date(now)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const recentReservationsSnap = await getDocs(
      query(
        collection(db, 'reservations'),
        where('createdAt', '>=', Timestamp.fromDate(monthAgo)),
        where('status', 'in', ['confirmed', 'completed']),
        firestoreLimit(1000) // Últimas 1,000 reservas
      )
    )

    let totalRevenue = 0
    let totalDeposits = 0
    let totalRefunds = 0
    let totalPendingPayments = 0
    let successfulPayments = 0
    let failedPayments = 0

    recentReservationsSnap.docs.forEach(doc => {
      const data = doc.data()
      const depositAmount = typeof data.depositAmountCents === 'number' ? data.depositAmountCents / 100 : 0
      const paymentStatus = data.paymentStatus || 'pending'

      if (paymentStatus === 'paid' || paymentStatus === 'captured') {
        totalRevenue += depositAmount
        totalDeposits += depositAmount
        successfulPayments++
      } else if (paymentStatus === 'refunded') {
        totalRefunds += depositAmount
      } else if (paymentStatus === 'pending') {
        totalPendingPayments += depositAmount
      } else if (paymentStatus === 'failed') {
        failedPayments++
      }
    })

    const totalTransactions = successfulPayments + failedPayments
    const conversionRate = totalTransactions > 0 ? (successfulPayments / totalTransactions) * 100 : 0
    const averageReservationValue = successfulPayments > 0 ? totalRevenue / successfulPayments : 0

    // MRR estimation (Monthly Recurring Revenue)
    // Asumiendo que las empresas pagan subscripción mensual
    const monthlyRecurringRevenue = totalRevenue // Simplificado

    return {
      totalRevenue,
      totalDeposits,
      totalRefunds,
      totalPendingPayments,
      averageReservationValue,
      monthlyRecurringRevenue,
      totalTransactions,
      successfulPayments,
      failedPayments,
      conversionRate,
    }
  } catch (error) {
    console.error('Error getting financial stats:', error)
    return {
      totalRevenue: 0,
      totalDeposits: 0,
      totalRefunds: 0,
      totalPendingPayments: 0,
      averageReservationValue: 0,
      monthlyRecurringRevenue: 0,
      totalTransactions: 0,
      successfulPayments: 0,
      failedPayments: 0,
      conversionRate: 0,
    }
  }
}

/**
 * Obtiene revenue por período (día, semana, mes)
 */
export async function getRevenueByPeriod(
  _period: 'day' | 'week' | 'month' = 'month',
  limitDays: number = 30
): Promise<RevenueByPeriod> {
  try {
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - limitDays)

    const reservationsSnap = await getDocs(
      query(
        collection(db, 'reservations'),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        firestoreLimit(2000)
      )
    )

    const dataByDate: Record<string, { revenue: number; deposits: number; refunds: number }> = {}

    reservationsSnap.docs.forEach(doc => {
      const data = doc.data()
      const createdAt = data.createdAt?.toDate() || new Date()
      const dateKey = createdAt.toISOString().split('T')[0] // YYYY-MM-DD
      const depositAmount = typeof data.depositAmountCents === 'number' ? data.depositAmountCents / 100 : 0
      const paymentStatus = data.paymentStatus || 'pending'

      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = { revenue: 0, deposits: 0, refunds: 0 }
      }

      if (paymentStatus === 'paid' || paymentStatus === 'captured') {
        dataByDate[dateKey].revenue += depositAmount
        dataByDate[dateKey].deposits += depositAmount
      } else if (paymentStatus === 'refunded') {
        dataByDate[dateKey].refunds += depositAmount
      }
    })

    const sortedDates = Object.keys(dataByDate).sort()
    const labels = sortedDates.map(date => {
      const d = new Date(date)
      return `${d.getDate()}/${d.getMonth() + 1}`
    })
    const revenue = sortedDates.map(date => dataByDate[date].revenue)
    const deposits = sortedDates.map(date => dataByDate[date].deposits)
    const refunds = sortedDates.map(date => dataByDate[date].refunds)

    return { labels, revenue, deposits, refunds }
  } catch (error) {
    console.error('Error getting revenue by period:', error)
    return { labels: [], revenue: [], deposits: [], refunds: [] }
  }
}

/**
 * Obtiene top empresas por revenue
 */
export async function getTopCompaniesByRevenue(limitCount: number = 10): Promise<TopCompanyByRevenue[]> {
  try {
    const companiesSnap = await getDocs(
      query(
        collection(db, 'companies'),
        firestoreLimit(500) // Top 500 empresas
      )
    )

    // const companyRevenue: Record<string, { name: string; revenue: number; count: number }> = {}

    // Para cada empresa, obtener sus reservas recientes
    const companyPromises = companiesSnap.docs.slice(0, 50).map(async (companyDoc) => {
      const companyId = companyDoc.id
      const companyName = companyDoc.data().name || 'Sin nombre'

      const reservationsSnap = await getDocs(
        query(
          collection(db, 'reservations'),
          where('companyId', '==', companyId),
          where('status', 'in', ['confirmed', 'completed']),
          firestoreLimit(100)
        )
      )

      let revenue = 0
      let count = 0

      reservationsSnap.docs.forEach(doc => {
        const data = doc.data()
        const depositAmount = typeof data.depositAmountCents === 'number' ? data.depositAmountCents / 100 : 0
        const paymentStatus = data.paymentStatus || 'pending'

        if (paymentStatus === 'paid' || paymentStatus === 'captured') {
          revenue += depositAmount
          count++
        }
      })

      return { companyId, companyName, revenue, count }
    })

    const results = await Promise.all(companyPromises)

    return results
      .filter(r => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limitCount)
      .map(r => ({
        companyId: r.companyId,
        companyName: r.companyName,
        totalRevenue: r.revenue,
        totalReservations: r.count,
        averageValue: r.count > 0 ? r.revenue / r.count : 0,
      }))
  } catch (error) {
    console.error('Error getting top companies by revenue:', error)
    return []
  }
}

/**
 * Obtiene estadísticas de métodos de pago
 */
export async function getPaymentMethodStats(): Promise<PaymentMethodStats[]> {
  try {
    const reservationsSnap = await getDocs(
      query(
        collection(db, 'reservations'),
        where('status', 'in', ['confirmed', 'completed']),
        firestoreLimit(1000)
      )
    )

    const methodStats: Record<string, { count: number; totalAmount: number }> = {}
    let totalAmount = 0

    reservationsSnap.docs.forEach(doc => {
      const data = doc.data()
      const paymentMethod = data.paymentMethod || 'card'
      const depositAmount = typeof data.depositAmountCents === 'number' ? data.depositAmountCents / 100 : 0
      const paymentStatus = data.paymentStatus || 'pending'

      if (paymentStatus === 'paid' || paymentStatus === 'captured') {
        if (!methodStats[paymentMethod]) {
          methodStats[paymentMethod] = { count: 0, totalAmount: 0 }
        }
        methodStats[paymentMethod].count++
        methodStats[paymentMethod].totalAmount += depositAmount
        totalAmount += depositAmount
      }
    })

    return Object.entries(methodStats).map(([method, stats]) => ({
      method,
      count: stats.count,
      totalAmount: stats.totalAmount,
      percentage: totalAmount > 0 ? (stats.totalAmount / totalAmount) * 100 : 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount)
  } catch (error) {
    console.error('Error getting payment method stats:', error)
    return []
  }
}

/**
 * Obtiene estadísticas de fianzas/depósitos
 */
export async function getDepositStats(): Promise<DepositStats> {
  try {
    const reservationsSnap = await getDocs(
      query(
        collection(db, 'reservations'),
        where('depositAmountCents', '>', 0),
        firestoreLimit(2000)
      )
    )

    let totalCollected = 0
    let totalRefunded = 0
    let totalPending = 0
    let totalDeposits = 0
    let successfulDeposits = 0

    reservationsSnap.docs.forEach(doc => {
      const data = doc.data()
      const depositAmount = typeof data.depositAmountCents === 'number' ? data.depositAmountCents / 100 : 0
      const paymentStatus = data.paymentStatus || 'pending'

      totalDeposits++

      if (paymentStatus === 'paid' || paymentStatus === 'captured') {
        totalCollected += depositAmount
        successfulDeposits++
      } else if (paymentStatus === 'refunded') {
        totalRefunded += depositAmount
      } else if (paymentStatus === 'pending') {
        totalPending += depositAmount
      }
    })

    const averageDepositAmount = successfulDeposits > 0 ? totalCollected / successfulDeposits : 0
    const depositSuccessRate = totalDeposits > 0 ? (successfulDeposits / totalDeposits) * 100 : 0

    return {
      totalCollected,
      totalRefunded,
      totalPending,
      averageDepositAmount,
      depositSuccessRate,
    }
  } catch (error) {
    console.error('Error getting deposit stats:', error)
    return {
      totalCollected: 0,
      totalRefunded: 0,
      totalPending: 0,
      averageDepositAmount: 0,
      depositSuccessRate: 0,
    }
  }
}
