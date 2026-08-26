import { HISTORICAL_MISSIONS } from '../data/gamificationMissions'
import type { FriendProfile } from '../types/friends'
import type { MissionDefinition, MissionProgress } from '../types/gamification'

function estimateReviews(friend: FriendProfile): number {
  return Math.max(0, Math.round(friend.missionsCompleted * 0.45))
}

function estimateRedemptions(friend: FriendProfile): number {
  return Math.max(0, Math.round(friend.missionsCompleted * 0.18))
}

function estimateHelpfulVotes(friend: FriendProfile): number {
  return Math.max(0, Math.round(friend.missionsCompleted * 1.6))
}

function estimateUniqueVenues(friend: FriendProfile): number {
  return Math.max(1, Math.round(friend.reservationsTotal * 0.55))
}

function evaluateFriendMission(
  mission: MissionDefinition,
  friend: FriendProfile,
): { current: number; completed: boolean } {
  const reviews = estimateReviews(friend)
  const redemptions = estimateRedemptions(friend)
  const venues = estimateUniqueVenues(friend)
  const reservations = friend.reservationsTotal
  const paxTotal = Math.round(reservations * 2.4)

  switch (mission.id) {
    case 'debut_gastronomico':
    case 'club_10_mesas':
    case 'socio_veterano':
    case 'maraton_gastro':
    case 'leyenda_restaurante':
    case 'centurion_mesas':
    case 'llama_eterna':
      return { current: reservations, completed: reservations >= mission.target }
    case 'primer_consumo_libre':
    case 'consumidor_habitual':
      return { current: Math.round(reservations * 0.4), completed: Math.round(reservations * 0.4) >= mission.target }
    case 'primer_gasto_minimo':
    case 'cazador_minimos':
    case 'primera_carta_productos':
      return { current: Math.round(reservations * 0.3), completed: Math.round(reservations * 0.3) >= mission.target }
    case 'ruta_de_bar':
    case 'ruta_de_restaurante':
      return { current: Math.round(venues * 0.4), completed: Math.round(venues * 0.4) >= mission.target }
    case 'corazon_favorito':
      return { current: friend.foodPreferences.length > 0 ? 1 : 0, completed: friend.foodPreferences.length > 0 }
    case 'mesa_grande':
      return { current: reservations >= mission.target ? mission.target : Math.min(reservations, mission.target), completed: reservations >= mission.target }
    case 'primera_opinion':
      return { current: reviews, completed: reviews >= 1 }
    case 'voz_barrio':
      return { current: reviews, completed: reviews >= 5 }
    case 'fotografo_gourmet':
      return { current: reviews, completed: reviews >= 10 }
    case 'maestro_resenas':
      return { current: reviews, completed: reviews >= 20 }
    case 'critico_destacado':
      return { current: reviews, completed: reviews >= 25 }
    case 'oraculo_sabores':
      return { current: reviews, completed: reviews >= 50 }
    case 'guia_michelin':
      return { current: estimateHelpfulVotes(friend), completed: estimateHelpfulVotes(friend) >= 50 }
    case 'primer_botin':
      return { current: redemptions, completed: redemptions >= 1 }
    case 'cazador_tesoros':
      return { current: redemptions, completed: redemptions >= 5 }
    case 'coleccionista_premios':
      return { current: redemptions, completed: redemptions >= 8 }
    case 'cazador_ofertas':
      return { current: Math.min(Math.round(reservations * 0.35), 3), completed: Math.round(reservations * 0.35) >= 3 }
    case 'nomada_digital':
      return { current: venues, completed: venues >= 10 }
    case 'explorador_zona':
      return { current: Math.min(Math.round(venues * 0.6), 5), completed: Math.round(venues * 0.6) >= 5 }
    case 'ruta_internacional':
      return { current: Math.min(friend.foodPreferences.length, 5), completed: friend.foodPreferences.length >= 5 }
    case 'embajador_local':
      return { current: venues, completed: venues >= 20 }
    case 'corona_gastro':
      return { current: venues, completed: venues >= 40 }
    case 'infiltrado_hosteleria':
    case 'titan_hosteleria':
      return { current: paxTotal, completed: paxTotal >= mission.target }
    case 'emperador_adelia':
      return { current: friend.level, completed: friend.level >= 10 }
    case 'cliente_fiel_meson':
      return { current: friend.streak >= 2 ? 1 : 0, completed: friend.streak >= 2 }
    default:
      return { current: 0, completed: false }
  }
}

export function buildFriendAchievementProgress(friend: FriendProfile): MissionProgress[] {
  return HISTORICAL_MISSIONS.map((mission) => {
    const { current, completed } = evaluateFriendMission(mission, friend)
    const progress = mission.target > 0 ? Math.min(1, current / mission.target) : 0

    return {
      mission,
      current,
      completed,
      progress,
    }
  })
}

export function getFriendEarnedAchievements(friend: FriendProfile): MissionProgress[] {
  return buildFriendAchievementProgress(friend).filter((item) => item.completed)
}
