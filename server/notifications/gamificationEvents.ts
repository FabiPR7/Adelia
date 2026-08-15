import type { DocumentData } from 'firebase-admin/firestore'
import { createCustomerNotification } from './service.ts'

const GAMIFICATION_MISSIONS: Record<string, { name: string; icon: string }> = {
  'weekly-reservations-2': { name: 'Dos reservas esta semana', icon: '📅' },
  'weekly-reservations-3': { name: 'Tres reservas esta semana', icon: '📅' },
  'weekly-new-restaurant': { name: 'Nuevo restaurante', icon: '🧭' },
  'weekly-promo-booking': { name: 'Reserva con promo', icon: '🏷️' },
  'weekly-review': { name: 'Deja una reseña', icon: '⭐' },
  'monthly-explorer-5': { name: 'Explorador del mes', icon: '🗺️' },
  'monthly-social-3': { name: 'Cenas en grupo', icon: '👥' },
  'hist-first-reservation': { name: 'Primera reserva', icon: '🍽️' },
  'hist-five-restaurants': { name: 'Cinco restaurantes', icon: '🌍' },
  'hist-ten-missions': { name: 'Diez misiones', icon: '🏆' },
}

const BADGE_DEFINITIONS: Array<{ id: string; name: string; icon: string; check: (ctx: BadgeContext) => boolean }> = [
  { id: 'first_reservation', name: 'Primera mesa', icon: '🍽️', check: (ctx) => ctx.missionsCompleted >= 1 },
  { id: 'explorer', name: 'Explorador', icon: '🧭', check: (ctx) => ctx.missionsCompleted >= 3 },
  { id: 'week_streak', name: 'Racha semanal', icon: '🔥', check: (ctx) => ctx.streak >= 3 },
  { id: 'mission_hunter', name: 'Cazador', icon: '🎯', check: (ctx) => ctx.missionsCompleted >= 5 },
  { id: 'social_diner', name: 'Cena social', icon: '👥', check: (ctx) => ctx.missionsCompleted >= 8 },
  { id: 'gourmet', name: 'Gourmet', icon: '⭐', check: (ctx) => ctx.missionsCompleted >= 10 },
  { id: 'level_5', name: 'Nivel 5', icon: '🥈', check: (ctx) => ctx.level >= 5 },
  { id: 'level_7', name: 'Nivel 7', icon: '🥇', check: (ctx) => ctx.level >= 7 },
  { id: 'level_10', name: 'Leyenda', icon: '👑', check: (ctx) => ctx.level >= 10 },
  { id: 'reviewer', name: 'Crítico', icon: '📝', check: (ctx) => ctx.missionsCompleted >= 15 },
  { id: 'offer_hunter', name: 'Cazador de ofertas', icon: '🏷️', check: (ctx) => ctx.missionsCompleted >= 12 },
  { id: 'foodie', name: 'Foodie', icon: '🍷', check: (ctx) => ctx.missionsCompleted >= 20 },
]

interface BadgeContext {
  level: number
  missionsCompleted: number
  streak: number
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function getLevelForXp(xp: number): number {
  if (xp >= 10000) return 7
  if (xp >= 6000) return 6
  if (xp >= 3200) return 5
  if (xp >= 1600) return 4
  if (xp >= 800) return 3
  if (xp >= 300) return 2
  return 1
}

function buildBadgeContext(gamification: DocumentData): BadgeContext {
  const completed = new Set([
    ...readStringArray(gamification.completedMissions),
    ...readStringArray(gamification.weeklyCompleted),
    ...readStringArray(gamification.monthlyCompleted),
  ])

  const xp = typeof gamification.xp === 'number' ? gamification.xp : 0

  return {
    level: getLevelForXp(xp),
    missionsCompleted: completed.size,
    streak: readStringArray(gamification.weeklyCompleted).length >= 1 ? 3 : 0,
  }
}

function earnedBadges(ctx: BadgeContext): string[] {
  return BADGE_DEFINITIONS.filter((badge) => badge.check(ctx)).map((badge) => badge.id)
}

function allCompletedMissionIds(gamification: DocumentData): string[] {
  return [
    ...readStringArray(gamification.completedMissions),
    ...readStringArray(gamification.weeklyCompleted),
    ...readStringArray(gamification.monthlyCompleted),
  ]
}

export async function notifyGamificationChanges(
  userId: string,
  before: DocumentData | undefined,
  after: DocumentData,
): Promise<void> {
  const beforeGamification = before?.gamification && typeof before.gamification === 'object'
    ? before.gamification as DocumentData
    : {}
  const afterGamification = after.gamification && typeof after.gamification === 'object'
    ? after.gamification as DocumentData
    : {}

  const beforeXp = typeof beforeGamification.xp === 'number' ? beforeGamification.xp : 0
  const afterXp = typeof afterGamification.xp === 'number' ? afterGamification.xp : 0
  const beforeLevel = getLevelForXp(beforeXp)
  const afterLevel = getLevelForXp(afterXp)

  if (afterLevel > beforeLevel) {
    await createCustomerNotification(userId, {
      type: 'level_up',
      title: `¡Nivel ${afterLevel}!`,
      body: `Has subido de nivel. Sigue sumando experiencias en Adelia.`,
      icon: '🚀',
      actionUrl: '/app/misiones',
      actionLabel: 'Ver progreso',
      dedupeKey: `level_up:${afterLevel}`,
      data: {
        fromLevel: beforeLevel,
        toLevel: afterLevel,
      },
    })
  }

  const beforeMissions = new Set(allCompletedMissionIds(beforeGamification))
  const afterMissions = allCompletedMissionIds(afterGamification)

  for (const missionId of afterMissions) {
    if (beforeMissions.has(missionId)) {
      continue
    }

    const mission = GAMIFICATION_MISSIONS[missionId] ?? {
      name: 'Misión completada',
      icon: '🏅',
    }

    await createCustomerNotification(userId, {
      type: 'mission_completed',
      title: 'Misión completada',
      body: `Has completado «${mission.name}».`,
      icon: mission.icon,
      actionUrl: '/app/misiones',
      actionLabel: 'Ver misiones',
      dedupeKey: `mission_completed:${missionId}`,
      data: {
        missionId,
        missionName: mission.name,
      },
    })
  }

  const beforeBadges = earnedBadges(buildBadgeContext(beforeGamification))
  const afterBadges = earnedBadges(buildBadgeContext(afterGamification))
  const beforeBadgeSet = new Set(beforeBadges)

  for (const badgeId of afterBadges) {
    if (beforeBadgeSet.has(badgeId)) {
      continue
    }

    const badge = BADGE_DEFINITIONS.find((entry) => entry.id === badgeId)
    if (!badge) {
      continue
    }

    await createCustomerNotification(userId, {
      type: 'badge_unlocked',
      title: 'Insignia desbloqueada',
      body: `Has conseguido la insignia «${badge.name}».`,
      icon: badge.icon,
      actionUrl: '/app/misiones',
      actionLabel: 'Ver insignias',
      dedupeKey: `badge_unlocked:${badgeId}`,
      data: {
        badgeId,
        badgeName: badge.name,
      },
    })
  }

  const beforeClaims = Array.isArray(beforeGamification.claimedPromotions)
    ? beforeGamification.claimedPromotions as Array<{ promotionId?: string; reservationId?: string; title?: string; companyId?: string }>
    : []
  const afterClaims = Array.isArray(afterGamification.claimedPromotions)
    ? afterGamification.claimedPromotions as Array<{ promotionId?: string; reservationId?: string; title?: string; companyId?: string; promotionType?: string }>
    : []

  if (afterClaims.length > beforeClaims.length) {
    const beforeKeys = new Set(
      beforeClaims.map((claim) => `${claim.promotionId ?? ''}:${claim.reservationId ?? claim.title ?? ''}`),
    )

    for (const claim of afterClaims) {
      const key = `${claim.promotionId ?? ''}:${claim.reservationId ?? claim.title ?? ''}`
      if (beforeKeys.has(key)) {
        continue
      }

      const promotionTitle = typeof claim.title === 'string' && claim.title.trim()
        ? claim.title.trim()
        : 'tu premio'

      await createCustomerNotification(userId, {
        type: 'promotion_claimed',
        title: '¡Premio conseguido!',
        body: `Has reclamado «${promotionTitle}».`,
        icon: '🎁',
        actionUrl: '/app/promociones',
        actionLabel: 'Ver reclamadas',
        dedupeKey: `promotion_claimed:${claim.reservationId ?? claim.promotionId ?? key}`,
        data: {
          promotionId: claim.promotionId,
          promotionTitle,
          companyId: claim.companyId,
          reservationId: claim.reservationId,
        },
      })
    }
  }
}

export async function notifyPromotionReadyToClaim(
  userId: string,
  companyId: string,
  promotionId: string,
  promotionTitle: string,
): Promise<void> {
  await createCustomerNotification(userId, {
    type: 'promotion_ready_to_claim',
    title: '¡Premio listo para reclamar!',
    body: `Ya puedes reclamar «${promotionTitle}» en el restaurante.`,
    icon: '🎉',
    actionUrl: '/app/promociones',
    actionLabel: 'Reclamar',
    dedupeKey: `promotion_ready_to_claim:${promotionId}:${userId}`,
    data: {
      companyId,
      promotionId,
      promotionTitle,
    },
  })
}
