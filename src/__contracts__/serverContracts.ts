// Contrato servidor ↔ web: si el servidor cambia la forma de una respuesta y la web no
// (o al revés), esto deja de compilar (`npm run build` / `tsc`). La app recibe los mismos
// tipos de la web (código común), así que también queda cubierta.
import type { BookingRules as ServerBookingRules } from '../../server/reservations/bookingRules'
import type { PromotionAvailability as ServerPromotionAvailability } from '../../server/promotions/promotionAvailability'
import type { LadderState as ServerLadderState } from '../../server/promotions/ladderProgress'
import type { DaySlot as ServerDaySlot } from '../../server/reservations/slotAvailability'
import type { CustomerGamificationState as ServerGamificationState, MissionProgress as ServerMissionProgress } from '../../server/gamification/missions/types'
import type { BookingRules } from '../types/bookingRules'
import type { CustomerGamificationState, MissionProgress } from '../types/gamification'
import type { PromotionAvailability } from '../services/promotionAvailability'
import type { LadderState } from '../services/customerLadders'
import type { DayAvailabilitySlot } from '../services/publicApi'

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

export type ContractChecks = [
  Assert<Same<ServerBookingRules, BookingRules>>,
  Assert<Same<ServerPromotionAvailability, PromotionAvailability>>,
  Assert<Same<ServerLadderState, LadderState>>,
  // La web añade el motivo de la promo a cada hora.
  Assert<Same<ServerDaySlot & { promoReason: string | null }, DayAvailabilitySlot>>,
  Assert<Same<ServerMissionProgress, MissionProgress>>,
  Assert<Same<ServerGamificationState, CustomerGamificationState>>,
]
