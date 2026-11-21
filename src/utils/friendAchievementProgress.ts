import { HISTORICAL_MISSIONS } from '../data/gamificationMissions'
import type { FriendProfile } from '../types/friends'
import type { MissionProgress } from '../types/gamification'

/**
 * Medallas de un amigo: las que de verdad ha conseguido (el servidor manda la lista
 * de logros completados en `badgeIds`). Antes se estimaban a partir de sus misiones y
 * reservas, y podían enseñar medallas que no tenía.
 */
export function buildFriendAchievementProgress(friend: FriendProfile): MissionProgress[] {
  const earned = new Set(friend.badgeIds ?? [])
  return HISTORICAL_MISSIONS.map((mission) => {
    const completed = earned.has(mission.id)
    return {
      mission,
      current: completed ? mission.target : 0,
      completed,
      progress: completed ? 1 : 0,
    }
  })
}

export function getFriendEarnedAchievements(friend: FriendProfile): MissionProgress[] {
  return buildFriendAchievementProgress(friend).filter((item) => item.completed)
}
