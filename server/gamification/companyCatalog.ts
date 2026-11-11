import { getRemoteCatalog } from '../data/remoteCatalog.ts'

// Niveles, misiones y XP de los restaurantes viven en Firestore
// (companyLevelCatalog, companyMissionCatalog y gameConfig/company); lo de abajo
// es solo el respaldo para cuando la base de datos está vacía o no responde.
const DEFAULT_COMPANY_CONFIG = {
  weeklySlotCount: 6,
  monthlySlotCount: 5,
  weeklyBonusTarget: 4,
  weeklyBonusXp: 120,
  confirmedXp: 15,
  reviewXp: 10,
  replyXp: 8,
}

function companyConfigValue(key: keyof typeof DEFAULT_COMPANY_CONFIG): number {
  return getRemoteCatalog().companyConfig[key] ?? DEFAULT_COMPANY_CONFIG[key]
}

export const companyWeeklySlotCount = () => companyConfigValue('weeklySlotCount')
export const companyMonthlySlotCount = () => companyConfigValue('monthlySlotCount')
export const companyWeeklyBonusTarget = () => companyConfigValue('weeklyBonusTarget')
export const companyWeeklyBonusXp = () => companyConfigValue('weeklyBonusXp')
export const companyConfirmedXp = () => companyConfigValue('confirmedXp')
export const companyReviewXp = () => companyConfigValue('reviewXp')
export const companyReplyXp = () => companyConfigValue('replyXp')

export interface CompanyLevelDef {
  level: number
  title: string
  minXp: number
  maxXp: number | null
}

export interface CompanyMissionDef {
  id: string
  name: string
  xp: number
  cadence: 'weekly' | 'monthly' | 'historical'
  icon: string
  target: number
  description: string
}

const DEFAULT_COMPANY_LEVELS: CompanyLevelDef[] = [
  { level: 1, title: 'Fogón Nuevo', minXp: 0, maxXp: 249 },
  { level: 2, title: 'Casa Abierta', minXp: 250, maxXp: 599 },
  { level: 3, title: 'Mesa de Barrio', minXp: 600, maxXp: 1099 },
  { level: 4, title: 'Casa de Confianza', minXp: 1100, maxXp: 1899 },
  { level: 5, title: 'Referente Local', minXp: 1900, maxXp: 2999 },
  { level: 6, title: 'Estrella de la Villa', minXp: 3000, maxXp: 4499 },
  { level: 7, title: 'Casa Ilustre', minXp: 4500, maxXp: 6499 },
  { level: 8, title: 'Leyenda del Fuego', minXp: 6500, maxXp: 8999 },
  { level: 9, title: 'Mesa Maestra', minXp: 9000, maxXp: 12499 },
  { level: 10, title: 'Emblema Adelia', minXp: 12500, maxXp: null },
]

const DEFAULT_COMPANY_MISSIONS: CompanyMissionDef[] = [
  { id: 'servicio_semana', name: 'Servicio de la semana', xp: 70, cadence: 'weekly', icon: '🍽️', target: 3, description: 'Confirma 3 reservas esta semana.' },
  { id: 'valle_semana', name: 'Valle lleno', xp: 45, cadence: 'weekly', icon: '📅', target: 1, description: 'Confirma una reserva de lunes a jueves.' },
  { id: 'finde_semana', name: 'Finde en casa', xp: 45, cadence: 'weekly', icon: '🎉', target: 1, description: 'Confirma una reserva de viernes a domingo.' },
  { id: 'respuesta_semana', name: 'Anfitrión atento', xp: 70, cadence: 'weekly', icon: '💬', target: 1, description: 'Responde a una reseña esta semana.' },
  { id: 'mesa_llena_semana', name: 'Mesa llena', xp: 55, cadence: 'weekly', icon: '👨‍👩‍👧‍👦', target: 1, description: 'Confirma una reserva de 4 o más.' },
  { id: 'ritmo_semana', name: 'Ritmo de sala', xp: 100, cadence: 'weekly', icon: '🔥', target: 5, description: 'Confirma 5 reservas esta semana.' },
  { id: 'oferta_viva', name: 'Carta de ofertas', xp: 40, cadence: 'weekly', icon: '🏷️', target: 1, description: 'Ten una promoción activa.' },
  { id: 'comida_semana', name: 'Servicio de comida', xp: 40, cadence: 'weekly', icon: '☀️', target: 1, description: 'Confirma una reserva de comida.' },
  { id: 'cena_semana', name: 'Servicio de cena', xp: 40, cadence: 'weekly', icon: '🌙', target: 1, description: 'Confirma una reserva de cena.' },
  { id: 'grupo_semana', name: 'Mesa de grupo', xp: 80, cadence: 'weekly', icon: '🥂', target: 1, description: 'Confirma una reserva de 8 o más.' },
  { id: 'dias_semana', name: 'Casa abierta', xp: 75, cadence: 'weekly', icon: '📆', target: 3, description: 'Confirma reservas en 3 días distintos.' },
  { id: 'bienvenida_semana', name: 'Bienvenida', xp: 90, cadence: 'weekly', icon: '🚪', target: 1, description: 'Confirma un comensal nuevo esta semana.' },
  { id: 'volumen_mes', name: 'Volumen del mes', xp: 250, cadence: 'monthly', icon: '📈', target: 12, description: 'Confirma 12 reservas este mes.' },
  { id: 'respuestas_mes', name: 'Conversación de casa', xp: 200, cadence: 'monthly', icon: '✍️', target: 3, description: 'Responde a 3 reseñas este mes.' },
  { id: 'valle_mes', name: 'Entre semana', xp: 180, cadence: 'monthly', icon: '🗓️', target: 4, description: 'Confirma 4 reservas de lunes a jueves.' },
  { id: 'nuevos_mes', name: 'Caras nuevas', xp: 220, cadence: 'monthly', icon: '✨', target: 4, description: 'Confirma 4 comensales nuevos.' },
  { id: 'nota_casa_mes', name: 'Nota de la casa', xp: 200, cadence: 'monthly', icon: '⭐', target: 4, description: 'Media de 4 o más este mes.' },
  { id: 'mesas_grandes_mes', name: 'Mesas grandes', xp: 180, cadence: 'monthly', icon: '🪑', target: 3, description: 'Confirma 3 reservas de 4 o más.' },
  { id: 'ritmo_mes', name: 'Sala a tope', xp: 320, cadence: 'monthly', icon: '🚀', target: 20, description: 'Confirma 20 reservas este mes.' },
  { id: 'finde_mes', name: 'Fines de fiesta', xp: 200, cadence: 'monthly', icon: '🥳', target: 4, description: 'Confirma 4 reservas de finde.' },
  { id: 'cubiertos_mes', name: 'Cubiertos del mes', xp: 280, cadence: 'monthly', icon: '🍴', target: 40, description: 'Suma 40 comensales confirmados.' },
  { id: 'fotos_mes', name: 'Casa con foto', xp: 160, cadence: 'monthly', icon: '📷', target: 2, description: 'Recibe 2 reseñas con foto.' },
  { id: 'primera_mesa', name: 'Primera mesa', xp: 80, cadence: 'historical', icon: '🎉', target: 1, description: 'Confirma tu primera reserva.' },
  { id: 'diez_servicios', name: 'Diez servicios', xp: 150, cadence: 'historical', icon: '🔟', target: 10, description: 'Confirma 10 reservas.' },
  { id: 'cincuenta_mesas', name: 'Cincuenta mesas', xp: 400, cadence: 'historical', icon: '🏅', target: 50, description: 'Confirma 50 reservas.' },
  { id: 'cien_reservas', name: 'Cien reservas', xp: 800, cadence: 'historical', icon: '💯', target: 100, description: 'Confirma 100 reservas.' },
  { id: 'doscientas_mesas', name: 'Sala veterana', xp: 1200, cadence: 'historical', icon: '🏛️', target: 200, description: 'Confirma 200 reservas.' },
  { id: 'veterano_adelia', name: 'Veterano Adelia', xp: 2000, cadence: 'historical', icon: '👑', target: 500, description: 'Confirma 500 reservas.' },
  { id: 'primera_opinion', name: 'Primera opinión', xp: 80, cadence: 'historical', icon: '📝', target: 1, description: 'Recibe tu primera reseña.' },
  { id: 'diez_opiniones', name: 'Diez voces', xp: 300, cadence: 'historical', icon: '🗣️', target: 10, description: 'Acumula 10 reseñas.' },
  { id: 'cincuenta_voces', name: 'Cincuenta voces', xp: 900, cadence: 'historical', icon: '📣', target: 50, description: 'Acumula 50 reseñas.' },
  { id: 'anfitrion_responde', name: 'Anfitrión que responde', xp: 250, cadence: 'historical', icon: '💌', target: 5, description: 'Responde a 5 reseñas.' },
  { id: 'maestro_respuesta', name: 'Maestro de sala', xp: 700, cadence: 'historical', icon: '🎩', target: 25, description: 'Responde a 25 reseñas.' },
  { id: 'media_cuatro', name: 'Cuatro Adelinas', xp: 400, cadence: 'historical', icon: '⭐', target: 4, description: 'Media de 4 con 5 reseñas.' },
  { id: 'media_brillante', name: 'Brillo de casa', xp: 800, cadence: 'historical', icon: '🌟', target: 5, description: 'Media de 4,5 con 10 reseñas.' },
  { id: 'adelinas_100', name: 'Cien Adelinas', xp: 350, cadence: 'historical', icon: '🪙', target: 100, description: 'Suma 100 Adelinas.' },
  { id: 'adelinas_500', name: 'Quinientas Adelinas', xp: 900, cadence: 'historical', icon: '💰', target: 500, description: 'Suma 500 Adelinas.' },
  { id: 'foto_casa', name: 'Casa con retrato', xp: 450, cadence: 'historical', icon: '📸', target: 8, description: 'Recibe 8 reseñas con foto.' },
  { id: 'grupo_festejo', name: 'Festejo', xp: 300, cadence: 'historical', icon: '🎊', target: 1, description: 'Confirma una reserva de 10 o más.' },
  { id: 'casa_del_barrio', name: 'Casa del barrio', xp: 500, cadence: 'historical', icon: '🏡', target: 5, description: 'Alcanza el nivel 5.' },
  { id: 'casa_ilustre', name: 'Casa ilustre', xp: 1000, cadence: 'historical', icon: '🏰', target: 7, description: 'Alcanza el nivel 7.' },
  { id: 'emblema_fogon', name: 'Emblema del fogón', xp: 2500, cadence: 'historical', icon: '💠', target: 10, description: 'Alcanza el nivel 10.' },
]

export function companyLevels(): CompanyLevelDef[] {
  return getRemoteCatalog().companyLevels ?? DEFAULT_COMPANY_LEVELS
}

export function companyMissions(): CompanyMissionDef[] {
  return getRemoteCatalog().companyMissions ?? DEFAULT_COMPANY_MISSIONS
}

export function getCompanyMission(id: string): CompanyMissionDef | null {
  return companyMissions().find((mission) => mission.id === id) ?? null
}

export function getCompanyLevelForXp(xp: number): CompanyLevelDef {
  const levels = companyLevels()
  const safeXp = Math.max(0, Math.trunc(xp))
  let current = levels[0]
  for (const level of levels) {
    if (safeXp >= level.minXp) {
      current = level
    }
  }
  return current
}

export function getCompanyXpToNext(xp: number, level = getCompanyLevelForXp(xp)): number | null {
  if (level.maxXp == null) {
    return null
  }
  return Math.max(0, level.maxXp + 1 - Math.max(0, Math.trunc(xp)))
}
