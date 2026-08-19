import type { DocumentData } from 'firebase-admin/firestore'
import { getLevelForXpFromCatalog, getMissionCatalogEntry } from '../data/gameCatalog.ts'
import { createCustomerNotification } from './service.ts'

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
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
  const beforeMissions = new Set(allCompletedMissionIds(beforeGamification))
  const afterMissions = allCompletedMissionIds(afterGamification)
  const newMissionIds = afterMissions.filter((missionId) => !beforeMissions.has(missionId))
  const beforeWeekKey = typeof beforeGamification.weekKey === 'string' ? beforeGamification.weekKey : ''
  const beforeHasProgress = beforeMissions.size > 0 || beforeXp > 0 || beforeWeekKey.length > 0

  if (!beforeHasProgress) {
    return
  }

  const [beforeLevel, afterLevel] = await Promise.all([
    getLevelForXpFromCatalog(beforeXp),
    getLevelForXpFromCatalog(afterXp),
  ])

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

  const looksLikeHistoryReplay = beforeMissions.size === 0 && newMissionIds.length > 1

  if (looksLikeHistoryReplay) {
    return
  }

  for (const missionId of newMissionIds) {
    const mission = await getMissionCatalogEntry(missionId) ?? {
      name: 'Misión completada',
      icon: '🏅',
      xp: 0,
      cadence: null,
    }

    const isHistoricalBadge = mission.cadence === 'historical'

    await createCustomerNotification(userId, {
      type: isHistoricalBadge ? 'badge_unlocked' : 'mission_completed',
      title: isHistoricalBadge ? 'Insignia desbloqueada' : 'Misión completada',
      body: isHistoricalBadge
        ? `Has conseguido la insignia «${mission.name}».`
        : `Has completado «${mission.name}».`,
      icon: mission.icon,
      actionUrl: '/app/misiones',
      actionLabel: isHistoricalBadge ? 'Ver logros' : 'Ver misiones',
      dedupeKey: isHistoricalBadge ? `badge_unlocked:${missionId}` : `mission_completed:${missionId}`,
      data: isHistoricalBadge
        ? { badgeId: missionId, badgeName: mission.name }
        : { missionId, missionName: mission.name },
    })
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
