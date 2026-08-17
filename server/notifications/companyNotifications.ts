import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'

export type CompanyNotificationType =
  | 'mission_completed'
  | 'badge_unlocked'
  | 'level_up'
  | 'adelinas_changed'
  | 'rating_changed'
  | 'review_received'

export interface CompanyNotificationPayload {
  type: CompanyNotificationType
  title: string
  body: string
  icon?: string
  actionTab?: string
  actionLabel?: string | null
  data?: Record<string, unknown>
  dedupeKey: string
}

function sanitizeDocId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 240)
}

export function companyNotificationsRef(companyId: string) {
  return adminDb.collection(COLLECTIONS.companies).doc(companyId).collection('notifications')
}

export function companyGamificationRef(companyId: string) {
  return adminDb.collection(COLLECTIONS.companyGamification).doc(companyId)
}

export async function createCompanyNotification(
  companyId: string,
  payload: CompanyNotificationPayload,
): Promise<boolean> {
  if (!companyId.trim()) {
    return false
  }

  const notificationId = sanitizeDocId(payload.dedupeKey)
  const notificationRef = companyNotificationsRef(companyId).doc(notificationId)
  const existing = await notificationRef.get()
  if (existing.exists) {
    return false
  }

  const now = Timestamp.now()
  await notificationRef.set({
    type: payload.type,
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? '🔔',
    read: false,
    readAt: null,
    createdAt: now,
    actionTab: payload.actionTab ?? 'compite-missions',
    actionLabel: payload.actionLabel ?? 'Ver Compite',
    data: payload.data ?? {},
    dedupeKey: payload.dedupeKey,
  })

  const statsRef = companyGamificationRef(companyId)
  const statsSnap = await statsRef.get()
  const currentUnread = typeof statsSnap.data()?.unreadCount === 'number'
    ? statsSnap.data()?.unreadCount as number
    : 0
  await statsRef.set({
    unreadCount: currentUnread + 1,
    updatedAt: now,
  }, { merge: true })

  return true
}

export async function notifyCompanyGamificationChanges(
  companyId: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): Promise<void> {
  const { getCompanyLevelForXp, getCompanyMission } = await import('../gamification/companyCatalog.ts')
  const beforeXp = typeof before?.xp === 'number' ? before.xp : 0
  const afterXp = typeof after.xp === 'number' ? after.xp : 0
  const beforeLevel = getCompanyLevelForXp(beforeXp).level
  const afterLevel = getCompanyLevelForXp(afterXp)
  if (afterLevel.level > beforeLevel) {
    await createCompanyNotification(companyId, {
      type: 'level_up',
      title: `Nivel ${afterLevel.level}: ${afterLevel.title}`,
      body: `Tu restaurante ha subido de nivel. Sigue confirmando reservas y cuidando las reseñas.`,
      icon: '🚀',
      actionTab: 'compite-missions',
      actionLabel: 'Ver nivel',
      dedupeKey: `level_up:${afterLevel.level}`,
      data: { fromLevel: beforeLevel, toLevel: afterLevel.level },
    })
  }

  const afterWeekKey = typeof after.weekKey === 'string' ? after.weekKey : ''
  const afterMonthKey = typeof after.monthKey === 'string' ? after.monthKey : ''
  const sameWeek = typeof before?.weekKey === 'string' && before.weekKey === afterWeekKey
  const sameMonth = typeof before?.monthKey === 'string' && before.monthKey === afterMonthKey

  const beforeWeekly = new Set(
    sameWeek && Array.isArray(before?.weeklyCompleted)
      ? before.weeklyCompleted.filter((item): item is string => typeof item === 'string')
      : [],
  )
  const beforeMonthly = new Set(
    sameMonth && Array.isArray(before?.monthlyCompleted)
      ? before.monthlyCompleted.filter((item): item is string => typeof item === 'string')
      : [],
  )
  const beforeHistorical = new Set(
    Array.isArray(before?.completedMissions)
      ? before.completedMissions.filter((item): item is string => typeof item === 'string')
      : [],
  )

  const afterWeekly = Array.isArray(after.weeklyCompleted)
    ? after.weeklyCompleted.filter((item): item is string => typeof item === 'string')
    : []
  const afterMonthly = Array.isArray(after.monthlyCompleted)
    ? after.monthlyCompleted.filter((item): item is string => typeof item === 'string')
    : []
  const afterHistorical = Array.isArray(after.completedMissions)
    ? after.completedMissions.filter((item): item is string => typeof item === 'string')
    : []

  const notifyMission = async (
    missionId: string,
    cadence: 'weekly' | 'monthly' | 'historical',
    periodKey: string,
  ) => {
    const mission = getCompanyMission(missionId)
    const isBadge = cadence === 'historical'
    await createCompanyNotification(companyId, {
      type: isBadge ? 'badge_unlocked' : 'mission_completed',
      title: isBadge ? 'Insignia desbloqueada' : 'Misión completada',
      body: isBadge
        ? `Has conseguido la insignia «${mission?.name ?? missionId}».`
        : `Has completado «${mission?.name ?? missionId}».`,
      icon: mission?.icon ?? '🏅',
      actionTab: 'compite-missions',
      actionLabel: isBadge ? 'Ver insignias' : 'Ver misiones',
      dedupeKey: isBadge
        ? `badge_unlocked:${missionId}`
        : `mission_completed:${periodKey}:${missionId}`,
      data: isBadge
        ? { badgeId: missionId, badgeName: mission?.name }
        : { missionId, missionName: mission?.name, periodKey },
    })
  }

  for (const missionId of afterWeekly) {
    if (missionId === 'weekly_bonus' || beforeWeekly.has(missionId)) {
      continue
    }
    await notifyMission(missionId, 'weekly', afterWeekKey || 'week')
  }

  for (const missionId of afterMonthly) {
    if (beforeMonthly.has(missionId)) {
      continue
    }
    await notifyMission(missionId, 'monthly', afterMonthKey || 'month')
  }

  for (const missionId of afterHistorical) {
    if (beforeHistorical.has(missionId)) {
      continue
    }
    await notifyMission(missionId, 'historical', 'all')
  }

  if (!beforeWeekly.has('weekly_bonus') && afterWeekly.includes('weekly_bonus')) {
    await createCompanyNotification(companyId, {
      type: 'mission_completed',
      title: 'Bonus de la semana',
      body: 'Has completado el cupo de misiones semanales. Suma extra de XP para tu casa.',
      icon: '🎁',
      actionTab: 'compite-missions',
      actionLabel: 'Ver misiones',
      dedupeKey: `weekly_bonus:${afterWeekKey || 'now'}`,
    })
  }
}

function averageLabel(sum: number, count: number): string {
  if (count <= 0) {
    return '—'
  }
  return (sum / count).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export async function notifyCompanyReviewScoreChange(input: {
  companyId: string
  kind: 'created' | 'updated' | 'deleted'
  customerName: string
  rating: number
  previous: { reviewCount: number; reviewRatingSum: number; reviewAdelinas: number }
  next: { reviewCount: number; reviewRatingSum: number; reviewAdelinas: number }
}): Promise<void> {
  const dayKey = new Date().toISOString().slice(0, 10)
  const prevAvg = input.previous.reviewCount > 0
    ? input.previous.reviewRatingSum / input.previous.reviewCount
    : 0
  const nextAvg = input.next.reviewCount > 0
    ? input.next.reviewRatingSum / input.next.reviewCount
    : 0

  if (input.kind === 'created') {
    await createCompanyNotification(input.companyId, {
      type: 'review_received',
      title: 'Nueva reseña',
      body: `${input.customerName || 'Un comensal'} te ha dejado ${input.rating} ${input.rating === 1 ? 'estrella' : 'estrellas'}.`,
      icon: '⭐',
      actionTab: 'clients-reviews',
      actionLabel: 'Ver reseñas',
      dedupeKey: `review_received:${input.companyId}:${dayKey}:${input.customerName.slice(0, 24)}:${input.rating}`,
      data: { rating: input.rating },
    })
  }

  if (input.next.reviewAdelinas !== input.previous.reviewAdelinas) {
    const up = input.next.reviewAdelinas > input.previous.reviewAdelinas
    await createCompanyNotification(input.companyId, {
      type: 'adelinas_changed',
      title: up ? 'Suben tus Adelinas' : 'Bajan tus Adelinas',
      body: `Tu puntuación Adelinas pasa de ${input.previous.reviewAdelinas} a ${input.next.reviewAdelinas}.`,
      icon: up ? '🪙' : '📉',
      actionTab: 'reports-reviews',
      actionLabel: 'Ver informe',
      dedupeKey: `adelinas:${input.companyId}:${dayKey}:${up ? 'up' : 'down'}:${input.next.reviewAdelinas}`,
      data: {
        from: input.previous.reviewAdelinas,
        to: input.next.reviewAdelinas,
      },
    })
  }

  const prevRounded = Math.round(prevAvg * 10)
  const nextRounded = Math.round(nextAvg * 10)
  if (input.next.reviewCount > 0 && nextRounded !== prevRounded) {
    const up = nextRounded > prevRounded
    await createCompanyNotification(input.companyId, {
      type: 'rating_changed',
      title: up ? 'Suben tus estrellas' : 'Bajan tus estrellas',
      body: `Tu nota media pasa de ${averageLabel(input.previous.reviewRatingSum, input.previous.reviewCount)} a ${averageLabel(input.next.reviewRatingSum, input.next.reviewCount)}.`,
      icon: up ? '📈' : '📉',
      actionTab: 'reports-reviews',
      actionLabel: 'Ver informe',
      dedupeKey: `rating:${input.companyId}:${dayKey}:${up ? 'up' : 'down'}:${nextRounded}`,
      data: { from: prevAvg, to: nextAvg },
    })
  }
}
