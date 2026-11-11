import { useMemo } from 'react'
import { useCustomerGamificationContext } from '../context/CustomerGamificationContext'
import { WEEKLY_BONUS_TARGET, WEEKLY_MISSION_BONUS_XP } from '../types/gamification'
import {
  closestMission,
  isAlmostDone,
  missionsFedByReservation,
  pendingMissions,
  weekTimeLeftLabel,
} from '../utils/missionNudges'

/**
 * Lo que hay que enseñar fuera de la pestaña Misiones para que apetezca
 * completarlas: cuántas quedan, cuál está más cerca y cómo va el bonus semanal.
 */
export function useMissionNudge() {
  const { weeklyProgress, monthlyProgress, weeklyBonus, loading, state } = useCustomerGamificationContext()

  return useMemo(() => {
    const pendingWeekly = pendingMissions(weeklyProgress)
    const pendingMonthly = pendingMissions(monthlyProgress)
    const pending = [...pendingWeekly, ...pendingMonthly]
    const closest = closestMission(pending)
    const bonusDone = Math.min(weeklyBonus.completedCount, WEEKLY_BONUS_TARGET)

    return {
      loading,
      pendingWeekly,
      pendingMonthly,
      pendingCount: pendingWeekly.length,
      closest,
      hasAlmostDone: pending.some(isAlmostDone),
      reservationFed: missionsFedByReservation(pending),
      visitedCompanyIds: state.visitedCompanyIds,
      bonus: {
        done: bonusDone,
        target: WEEKLY_BONUS_TARGET,
        xp: WEEKLY_MISSION_BONUS_XP,
        earned: weeklyBonus.bonusEarned,
        left: Math.max(0, WEEKLY_BONUS_TARGET - bonusDone),
      },
      timeLeft: weekTimeLeftLabel(),
    }
  }, [weeklyProgress, monthlyProgress, weeklyBonus, loading, state.visitedCompanyIds])
}

export type MissionNudge = ReturnType<typeof useMissionNudge>
