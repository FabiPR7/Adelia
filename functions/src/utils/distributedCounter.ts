/**
 * Distributed Counter - Elimina hot spots en Firestore
 * 
 * Problema: Un solo documento puede manejar máximo ~500 escrituras/segundo
 * Solución: Dividir el contador en múltiples shards
 * 
 * Resultado: 10 shards = 5,000 escrituras/segundo
 *            100 shards = 50,000 escrituras/segundo
 */

import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { adminDb } from '../../server/firebase-admin.ts'

interface CounterShard {
  count: number
  updatedAt: FieldValue
}

/**
 * Distributed Counter que escala horizontalmente
 */
export class DistributedCounter {
  private db: Firestore
  private numShards: number

  /**
   * @param numShards - Número de shards (10-100 recomendado)
   *                    Más shards = más escrituras/segundo pero más lecturas para obtener total
   */
  constructor(numShards: number = 10) {
    this.db = adminDb
    this.numShards = numShards
  }

  /**
   * Incrementa el contador distribuido
   * 
   * @param path - Path base del contador (ej: 'companies/ABC123/stats')
   * @param counterName - Nombre del contador (ej: 'totalReservations')
   * @param incrementBy - Cantidad a incrementar (default: 1)
   * @param transaction - Transacción opcional (para operaciones atómicas)
   */
  async increment(
    path: string,
    counterName: string,
    incrementBy: number = 1,
    transaction?: Transaction
  ): Promise<void> {
    // Elegir shard aleatorio para distribuir la carga
    const shardId = Math.floor(Math.random() * this.numShards)
    const shardPath = `${path}/${counterName}_shards/${shardId}`
    const shardRef = this.db.doc(shardPath)

    const updateData: any = {
      count: FieldValue.increment(incrementBy),
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (transaction) {
      // Dentro de una transacción
      const shardSnap = await transaction.get(shardRef)
      if (shardSnap.exists) {
        transaction.update(shardRef, updateData)
      } else {
        transaction.set(shardRef, {
          count: incrementBy,
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    } else {
      // Fuera de transacción
      await shardRef.set(updateData, { merge: true })
    }
  }

  /**
   * Obtiene el valor total del contador sumando todos los shards
   * 
   * @param path - Path base del contador
   * @param counterName - Nombre del contador
   * @returns Total del contador
   */
  async getCount(path: string, counterName: string): Promise<number> {
    const shardsPath = `${path}/${counterName}_shards`
    const shardsSnap = await this.db.collection(shardsPath).get()

    let total = 0
    shardsSnap.forEach(doc => {
      const data = doc.data() as CounterShard
      total += data.count || 0
    })

    return total
  }

  /**
   * Resetea todos los shards de un contador
   * 
   * @param path - Path base del contador
   * @param counterName - Nombre del contador
   */
  async reset(path: string, counterName: string): Promise<void> {
    const shardsPath = `${path}/${counterName}_shards`
    const shardsSnap = await this.db.collection(shardsPath).get()

    const batch = this.db.batch()
    shardsSnap.forEach(doc => {
      batch.delete(doc.ref)
    })
    await batch.commit()
  }

  /**
   * Obtiene estadísticas del contador (útil para debugging)
   */
  async getStats(path: string, counterName: string): Promise<{
    total: number
    shards: number
    avgPerShard: number
    maxShard: number
    minShard: number
  }> {
    const shardsPath = `${path}/${counterName}_shards`
    const shardsSnap = await this.db.collection(shardsPath).get()

    let total = 0
    let max = 0
    let min = Number.MAX_SAFE_INTEGER

    shardsSnap.forEach(doc => {
      const count = (doc.data() as CounterShard).count || 0
      total += count
      max = Math.max(max, count)
      min = Math.min(min, count)
    })

    return {
      total,
      shards: shardsSnap.size,
      avgPerShard: shardsSnap.size > 0 ? total / shardsSnap.size : 0,
      maxShard: max,
      minShard: min === Number.MAX_SAFE_INTEGER ? 0 : min,
    }
  }
}

/**
 * Helper para usar distributed counters en transacciones
 * 
 * @example
 * await db.runTransaction(async (transaction) => {
 *   // ... otras operaciones ...
 *   
 *   await incrementDistributedCounter(
 *     transaction,
 *     'companies/ABC123/stats',
 *     'totalReservations',
 *     1
 *   )
 * })
 */
export async function incrementDistributedCounter(
  transaction: Transaction,
  path: string,
  counterName: string,
  incrementBy: number = 1,
  numShards: number = 10
): Promise<void> {
  const counter = new DistributedCounter(numShards)
  await counter.increment(path, counterName, incrementBy, transaction)
}

/**
 * Configuración de contadores para diferentes colecciones
 */
export const COUNTER_CONFIGS = {
  // Stats de empresa - alta concurrencia
  companyStats: {
    totalReservations: { shards: 20 }, // 20 shards = ~10,000 escrituras/s
    totalReviews: { shards: 10 },
    totalCustomers: { shards: 10 },
  },

  // Stats de usuario - concurrencia media
  userStats: {
    totalPoints: { shards: 5 },
    totalReservations: { shards: 5 },
  },

  // Stats globales - alta concurrencia
  globalStats: {
    totalUsers: { shards: 20 },
    totalCompanies: { shards: 10 },
    totalReservations: { shards: 30 }, // Muy alta concurrencia
  },
} as const

/**
 * Cloud Function para obtener totales de contadores
 * Útil para dashboards
 */
export async function getCounterTotal(
  path: string,
  counterName: string,
  numShards: number = 10
): Promise<number> {
  const counter = new DistributedCounter(numShards)
  return await counter.getCount(path, counterName)
}
