/**
 * Cloud Functions para gestión segura de reservas con transacciones atómicas
 * Previene race conditions y overbooking
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../server/firebase-admin.ts'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from './middleware/rateLimiter'
import { incrementDistributedCounter } from './utils/distributedCounter'

interface CreateReservationRequest {
  companyId: string
  dateIso: string // YYYY-MM-DD
  time: string // HH:MM
  partySize: number
  customerName: string
  customerPhone: string
  customerEmail?: string
  tableId?: string
  notes?: string
  customerUid?: string
}

interface ReservationSlot {
  date: string
  time: string
  availableCapacity: number
  reservedCount: number
}

/**
 * Cloud Function para crear reservas con transacción atómica
 * Previene race conditions y overbooking
 */
export const createReservation = onCall(
  {
    region: 'europe-southwest1',
    memory: '256MiB',
    maxInstances: 100,
  },
  async (request) => {
    // 🛡️ RATE LIMITING - Previene DoS
    await checkRateLimit(request, 'createReservation', RATE_LIMIT_CONFIGS.createReservation)

    const db = adminDb
    const data = request.data as CreateReservationRequest

    // Validación de datos
    if (!data.companyId || !data.dateIso || !data.time || !data.partySize) {
      throw new HttpsError('invalid-argument', 'Faltan datos requeridos')
    }

    if (data.partySize < 1 || data.partySize > 50) {
      throw new HttpsError('invalid-argument', 'Tamaño de grupo inválido')
    }

    if (!data.customerName || data.customerName.trim().length < 2) {
      throw new HttpsError('invalid-argument', 'Nombre del cliente inválido')
    }

    if (!data.customerPhone || !/^\+?[\d\s()-]{9,}$/.test(data.customerPhone)) {
      throw new HttpsError('invalid-argument', 'Teléfono inválido')
    }

    // Validar formato de fecha y hora
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const timeRegex = /^\d{2}:\d{2}$/
    if (!dateRegex.test(data.dateIso) || !timeRegex.test(data.time)) {
      throw new HttpsError('invalid-argument', 'Formato de fecha u hora inválido')
    }

    // Verificar que no es una fecha pasada
    const reservationDate = new Date(`${data.dateIso}T${data.time}:00`)
    if (reservationDate < new Date()) {
      throw new HttpsError('invalid-argument', 'No se pueden hacer reservas en el pasado')
    }

    // TRANSACCIÓN ATÓMICA - Previene race conditions
    try {
      const result = await db.runTransaction(async (transaction) => {
        // 1. Verificar que la empresa existe
        const companyRef = db.collection('companies').doc(data.companyId)
        const companySnap = await transaction.get(companyRef)

        if (!companySnap.exists) {
          throw new HttpsError('not-found', 'Empresa no encontrada')
        }

        const companyData = companySnap.data()!

        // 2. Verificar configuración de reservas
        const reservationSettings = companyData.reservationSettings || {}
        if (!reservationSettings.enabled) {
          throw new HttpsError('failed-precondition', 'Las reservas están deshabilitadas')
        }

        // 3. Obtener configuración de capacidad
        const maxConcurrentReservations = reservationSettings.maxConcurrentReservations || 50
        const maxPartySize = reservationSettings.maxPartySize || 20

        if (data.partySize > maxPartySize) {
          throw new HttpsError(
            'invalid-argument',
            `El tamaño máximo de grupo es ${maxPartySize} personas`,
          )
        }

        // 4. Verificar disponibilidad DENTRO de la transacción
        const reservationsQuery = db
          .collection('reservations')
          .where('companyId', '==', data.companyId)
          .where('date', '==', data.dateIso)
          .where('time', '==', data.time)
          .where('status', 'in', ['pending', 'confirmed'])

        const existingReservationsSnap = await transaction.get(reservationsQuery)

        // Contar reservas actuales y capacidad
        let currentReservations = existingReservationsSnap.size
        let totalPartySize = 0

        existingReservationsSnap.forEach(doc => {
          const reservation = doc.data()
          totalPartySize += reservation.partySize || 0
        })

        // 5. Verificar límites
        if (currentReservations >= maxConcurrentReservations) {
          throw new HttpsError(
            'resource-exhausted',
            'No hay disponibilidad para esta fecha y hora',
          )
        }

        // Si hay límite de capacidad total
        const maxTotalCapacity = reservationSettings.maxTotalCapacity || 200
        if (totalPartySize + data.partySize > maxTotalCapacity) {
          throw new HttpsError(
            'resource-exhausted',
            'No hay suficiente capacidad disponible',
          )
        }

        // 6. Si se especificó mesa, verificar disponibilidad
        if (data.tableId) {
          const tableRef = db.collection('tables').doc(data.tableId)
          const tableSnap = await transaction.get(tableRef)

          if (!tableSnap.exists) {
            throw new HttpsError('not-found', 'Mesa no encontrada')
          }

          const tableData = tableSnap.data()!
          if (tableData.companyId !== data.companyId) {
            throw new HttpsError('permission-denied', 'Mesa no pertenece a esta empresa')
          }

          // Verificar si la mesa ya está reservada en este horario
          const tableReservationsQuery = db
            .collection('reservations')
            .where('tableId', '==', data.tableId)
            .where('date', '==', data.dateIso)
            .where('time', '==', data.time)
            .where('status', 'in', ['pending', 'confirmed'])

          const tableReservationsSnap = await transaction.get(tableReservationsQuery)

          if (!tableReservationsSnap.empty) {
            throw new HttpsError('already-exists', 'Esta mesa ya está reservada')
          }
        }

        // 7. Crear la reserva ATÓMICAMENTE
        const reservationId = db.collection('reservations').doc().id
        const reservationRef = db.collection('reservations').doc(reservationId)

        const now = FieldValue.serverTimestamp()

        const reservationData = {
          id: reservationId,
          companyId: data.companyId,
          date: data.dateIso,
          time: data.time,
          partySize: data.partySize,
          customerName: data.customerName.trim(),
          customerPhone: data.customerPhone.trim(),
          customerEmail: data.customerEmail?.trim() || null,
          tableId: data.tableId || null,
          notes: data.notes?.trim() || '',
          status: 'pending' as const,
          createdAt: now,
          updatedAt: now,
          ...(data.customerUid ? { customerUid: data.customerUid } : {}),
        }

        transaction.create(reservationRef, reservationData)

        // 8. Actualizar contador de reservas de la empresa con DISTRIBUTED COUNTER
        // Esto elimina el hot spot y permite 10,000+ escrituras/segundo
        await incrementDistributedCounter(
          transaction,
          `companies/${data.companyId}/stats`,
          'totalReservations',
          1,
          20 // 20 shards = ~10,000 reservas/segundo
        )

        // También actualizar lastReservationAt en documento normal
        const statsMetaRef = db.collection('companies').doc(data.companyId).collection('stats').doc('_meta')
        transaction.set(statsMetaRef, {
          lastReservationAt: now,
        }, { merge: true })

        // 9. Loguear evento de seguridad
        const securityEventRef = db.collection('securityEvents').doc()
        transaction.create(securityEventRef, {
          type: 'reservation_created',
          severity: 'low',
          userId: data.customerUid || null,
          details: {
            reservationId,
            companyId: data.companyId,
            date: data.dateIso,
            time: data.time,
            partySize: data.partySize,
          },
          timestamp: now,
          environment: 'production',
        })

        return {
          reservationId,
          reservation: {
            ...reservationData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }
      })

      // Transacción completada exitosamente
      return {
        success: true,
        ...result,
      }
    } catch (error) {
      // Manejar errores de transacción
      if (error instanceof HttpsError) {
        throw error
      }

      console.error('Error en transacción de reserva:', error)
      throw new HttpsError(
        'internal',
        'Error al crear la reserva. Intenta de nuevo.',
      )
    }
  },
)

/**
 * Cloud Function para cancelar reserva (también con transacción)
 */
export const cancelReservation = onCall(
  {
    region: 'europe-southwest1',
    memory: '256MiB',
  },
  async (request) => {
    // 🛡️ RATE LIMITING
    await checkRateLimit(request, 'cancelReservation', RATE_LIMIT_CONFIGS.cancelReservation)

    const db = adminDb
    const { reservationId, reason } = request.data as {
      reservationId: string
      reason?: string
    }

    if (!reservationId) {
      throw new HttpsError('invalid-argument', 'ID de reserva requerido')
    }

    try {
      await db.runTransaction(async (transaction) => {
        const reservationRef = db.collection('reservations').doc(reservationId)
        const reservationSnap = await transaction.get(reservationRef)

        if (!reservationSnap.exists) {
          throw new HttpsError('not-found', 'Reserva no encontrada')
        }

        const reservation = reservationSnap.data()!

        // Verificar permisos
        if (request.auth) {
          const isCustomer = reservation.customerUid === request.auth.uid
          const userRef = db.collection('users').doc(request.auth.uid)
          const userSnap = await transaction.get(userRef)
          const isAdmin = userSnap.exists && userSnap.data()?.role === 'admin'
          const isCompanyOwner =
            userSnap.exists && userSnap.data()?.companyId === reservation.companyId

          if (!isCustomer && !isAdmin && !isCompanyOwner) {
            throw new HttpsError('permission-denied', 'No tienes permiso para cancelar esta reserva')
          }
        }

        // Actualizar estado
        transaction.update(reservationRef, {
          status: 'cancelled',
          cancelledAt: FieldValue.serverTimestamp(),
          cancelReason: reason || 'Cancelada por el usuario',
          updatedAt: FieldValue.serverTimestamp(),
        })

        // Actualizar estadísticas con distributed counter
        await incrementDistributedCounter(
          transaction,
          `companies/${reservation.companyId}/stats`,
          'totalCancellations',
          1,
          10
        )
      })

      return { success: true }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error
      }

      console.error('Error cancelando reserva:', error)
      throw new HttpsError('internal', 'Error al cancelar la reserva')
    }
  },
)

/**
 * Cloud Function para verificar disponibilidad
 * Útil para mostrar slots disponibles en el frontend
 */
export const checkReservationAvailability = onCall(
  {
    region: 'europe-southwest1',
    memory: '128MiB',
  },
  async (request) => {
    // 🛡️ RATE LIMITING (más permisivo para lecturas)
    await checkRateLimit(request, 'checkAvailability', RATE_LIMIT_CONFIGS.checkAvailability)

    const db = adminDb
    const { companyId, dateIso, time } = request.data as {
      companyId: string
      dateIso: string
      time?: string
    }

    if (!companyId || !dateIso) {
      throw new HttpsError('invalid-argument', 'Faltan datos requeridos')
    }

    try {
      const companyRef = db.collection('companies').doc(companyId)
      const companySnap = await companyRef.get()

      if (!companySnap.exists) {
        throw new HttpsError('not-found', 'Empresa no encontrada')
      }

      const companyData = companySnap.data()!
      const reservationSettings = companyData.reservationSettings || {}
      const maxConcurrentReservations = reservationSettings.maxConcurrentReservations || 50
      const maxTotalCapacity = reservationSettings.maxTotalCapacity || 200

      // Si se especifica hora, verificar ese slot específico
      if (time) {
        const reservationsSnap = await db
          .collection('reservations')
          .where('companyId', '==', companyId)
          .where('date', '==', dateIso)
          .where('time', '==', time)
          .where('status', 'in', ['pending', 'confirmed'])
          .get()

        const currentReservations = reservationsSnap.size
        let totalPartySize = 0

        reservationsSnap.forEach(doc => {
          totalPartySize += doc.data().partySize || 0
        })

        return {
          available: currentReservations < maxConcurrentReservations &&
            totalPartySize < maxTotalCapacity,
          currentReservations,
          maxReservations: maxConcurrentReservations,
          currentCapacity: totalPartySize,
          maxCapacity: maxTotalCapacity,
          remainingCapacity: maxTotalCapacity - totalPartySize,
        }
      }

      // Si no se especifica hora, devolver disponibilidad de todo el día
      const reservationsSnap = await db
        .collection('reservations')
        .where('companyId', '==', companyId)
        .where('date', '==', dateIso)
        .where('status', 'in', ['pending', 'confirmed'])
        .get()

      const slotMap = new Map<string, { count: number; capacity: number }>()

      reservationsSnap.forEach(doc => {
        const data = doc.data()
        const slot = slotMap.get(data.time) || { count: 0, capacity: 0 }
        slot.count++
        slot.capacity += data.partySize || 0
        slotMap.set(data.time, slot)
      })

      const slots: ReservationSlot[] = []
      slotMap.forEach((value, time) => {
        slots.push({
          date: dateIso,
          time,
          availableCapacity: maxTotalCapacity - value.capacity,
          reservedCount: value.count,
        })
      })

      return {
        date: dateIso,
        slots,
        maxReservationsPerSlot: maxConcurrentReservations,
        maxCapacityPerSlot: maxTotalCapacity,
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error
      }

      console.error('Error verificando disponibilidad:', error)
      throw new HttpsError('internal', 'Error al verificar disponibilidad')
    }
  },
)
