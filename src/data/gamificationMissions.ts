import type { MissionDefinition } from '../types/gamification'

export let WEEKLY_MISSIONS: MissionDefinition[] = [
  {
    id: 'plan_fin_semana',
    name: 'Plan de Fin de Semana',
    xp: 60,
    cadence: 'weekly',
    description: 'Haz 1 reserva para viernes, sábado o domingo',
    icon: '📅',
    target: 1,
  },
  {
    id: 'cena_amigos',
    name: 'Cena con Amigos',
    xp: 80,
    cadence: 'weekly',
    description: 'Completa 1 reserva para 3 o más personas',
    icon: '👥',
    target: 1,
  },
  {
    id: 'reserva_relampago',
    name: 'Reserva Relámpago',
    xp: 50,
    cadence: 'weekly',
    description: 'Haz 1 reserva para comer o cenar hoy mismo',
    icon: '⚡',
    target: 1,
  },
  {
    id: 'reserva_anticipada',
    name: 'Reserva Anticipada',
    xp: 40,
    cadence: 'weekly',
    description: 'Reserva con al menos 3 días de antelación',
    icon: '🗓️',
    target: 1,
  },
  {
    id: 'gourmet_reincidente',
    name: 'Gourmet Reincidente',
    xp: 100,
    cadence: 'weekly',
    description: 'Asiste a 2 reservas diferentes esta semana',
    icon: '🍽️',
    target: 2,
  },
  {
    id: 'descubrimiento_semanal',
    name: 'Descubrimiento Semanal',
    xp: 90,
    cadence: 'weekly',
    description: 'Reserva en un restaurante donde no hayas ido',
    icon: '🧭',
    target: 1,
  },
  {
    id: 'en_busca_ofertas',
    name: 'En busca de Ofertas',
    xp: 60,
    cadence: 'weekly',
    description: 'Reserva en un local con oferta activa',
    icon: '🏷️',
    target: 1,
  },
  {
    id: 'fiel_seguidor',
    name: 'Fiel Seguidor',
    xp: 30,
    cadence: 'weekly',
    description: 'Guarda 3 restaurantes nuevos en Favoritos',
    icon: '♥',
    target: 3,
  },
  {
    id: 'critico_foto',
    name: 'El Crítico con Foto',
    xp: 70,
    cadence: 'weekly',
    category: 'reviews',
    description: 'Sube 1 reseña con foto tras tu reserva',
    icon: 'adelina-review',
    target: 1,
  },
  {
    id: 'voz_experiencia',
    name: 'La Voz de la Experiencia',
    xp: 40,
    cadence: 'weekly',
    category: 'reviews',
    description: 'Escribe 1 reseña de texto tras tu visita',
    icon: 'adelina-review',
    target: 1,
  },
  {
    id: 'ruta_especialidades',
    name: 'Ruta de Especialidades',
    xp: 80,
    cadence: 'weekly',
    description: 'Reserva en un local de categoría específica',
    icon: '🍣',
    target: 1,
  },
  {
    id: 'apoyo_hosteleria',
    name: 'Apoyo a la Hostelería',
    xp: 70,
    cadence: 'weekly',
    description: 'Reserva de lunes a jueves',
    icon: '🤝',
    target: 1,
  },
]

export let MONTHLY_MISSION_POOL: MissionDefinition[] = [
  {
    id: 'ruta_gastronomica',
    name: 'Ruta Gastronómica de Adelia',
    xp: 350,
    cadence: 'monthly',
    description: 'Completa 4 reservas asistidas en el mes',
    icon: '🛤️',
    target: 4,
  },
  {
    id: 'critico_consistente',
    name: 'Crítico Consistente',
    xp: 250,
    cadence: 'monthly',
    category: 'reviews',
    description: 'Publica 3 reseñas detalladas con foto',
    icon: 'adelina-review',
    target: 3,
  },
  {
    id: 'cazador_adelinas',
    name: 'Cazador de Adelinas',
    xp: 200,
    cadence: 'monthly',
    category: 'rewards',
    description: 'Canjea 1 premio de fidelización',
    icon: 'adelina',
    target: 1,
  },
  {
    id: 'explorador_ciudad',
    name: 'Explorador de Ciudad',
    xp: 300,
    cadence: 'monthly',
    description: 'Reserva en 3 zonas distintas',
    icon: '🏙️',
    target: 3,
  },
  {
    id: 'menu_completo',
    name: 'Menú Completo',
    xp: 300,
    cadence: 'monthly',
    description: '1 reserva en comida y 1 en cena',
    icon: '🌗',
    target: 2,
  },
  {
    id: 'maraton_mensual',
    name: 'Maratón Mensual',
    xp: 320,
    cadence: 'monthly',
    description: 'Completa 6 reservas asistidas en el mes',
    icon: '🏃',
    target: 6,
  },
  {
    id: 'grupo_grande_mes',
    name: 'Mesa Grande del Mes',
    xp: 220,
    cadence: 'monthly',
    description: 'Reserva para 4 o más personas',
    icon: '👨‍👩‍👧‍👦',
    target: 1,
  },
  {
    id: 'promo_doble_mes',
    name: 'Doble Promo',
    xp: 280,
    cadence: 'monthly',
    category: 'rewards',
    description: 'Reserva 2 veces en locales con oferta activa',
    icon: '🏷️',
    target: 2,
  },
  {
    id: 'finde_gourmet_mes',
    name: 'Finde Gourmet',
    xp: 260,
    cadence: 'monthly',
    description: 'Completa 2 reservas en fin de semana',
    icon: '🥂',
    target: 2,
  },
  {
    id: 'valle_laboral_mes',
    name: 'Valle Laboral',
    xp: 240,
    cadence: 'monthly',
    description: 'Reserva 2 veces de lunes a jueves',
    icon: '🤝',
    target: 2,
  },
  {
    id: 'descubridor_mes',
    name: 'Descubridor del Mes',
    xp: 300,
    cadence: 'monthly',
    description: 'Visita 2 restaurantes nuevos este mes',
    icon: '🧭',
    target: 2,
  },
]

/** @deprecated Usar rotateMonthlyMissions() para obtener las misiones activas del mes. */
export let MONTHLY_MISSIONS = MONTHLY_MISSION_POOL

export let HISTORICAL_MISSIONS: MissionDefinition[] = [
  { id: 'debut_gastronomico', name: 'Debut Gastronómico', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Completa tu primera reserva asistida', icon: '🎉', target: 1 },
  { id: 'corazon_favorito', name: 'Corazón Favorito', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Guarda tu primer restaurante favorito', icon: '❤️', target: 1 },
  { id: 'almuerzo_sol', name: 'Almuerzo al Sol', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Reserva una mesa a mediodía', icon: '☀️', target: 1 },
  { id: 'cena_especial', name: 'Cena Especial', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Reserva una mesa para cenar', icon: '🌙', target: 1 },
  { id: 'martes_valiente', name: 'Martes Valiente', xp: 175, cadence: 'historical', category: 'loyalty', description: 'Reserva entre semana en horario valle', icon: '📅', target: 1 },
  { id: 'mesa_para_dos', name: 'Mesa para Dos', xp: 175, cadence: 'historical', category: 'loyalty', description: 'Reserva para 2 personas o más', icon: '🥂', target: 1 },
  { id: 'reserva_relampago_logro', name: 'Reserva Relámpago', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Reserva el mismo día que vas a comer', icon: '⚡', target: 1 },
  { id: 'primera_opinion', name: 'Primera Opinión', xp: 100, cadence: 'historical', category: 'reviews', description: 'Publica tu primera reseña verificada', icon: '✍️', target: 1 },
  { id: 'primer_botin', name: 'Primer Botín', xp: 150, cadence: 'historical', category: 'rewards', description: 'Canjea tu primer premio de fidelización', icon: '🎁', target: 1 },
  { id: 'cliente_fiel_meson', name: 'Cliente Fiel del Mesón', xp: 300, cadence: 'historical', category: 'loyalty', description: 'Completa la tarjeta de fidelidad en un local', icon: '🃏', target: 1 },
  { id: 'nomada_digital', name: 'Nómada Digital', xp: 300, cadence: 'historical', category: 'exploration', description: 'Reserva en 10 restaurantes distintos', icon: '🌍', target: 10 },
  { id: 'club_10_mesas', name: 'Club de las 10 Mesas', xp: 500, cadence: 'historical', category: 'loyalty', description: 'Completa 10 reservas asistidas', icon: '🪑', target: 10 },
  { id: 'racha_mensual', name: 'Racha Mensual', xp: 350, cadence: 'historical', category: 'loyalty', description: 'Haz 3 reservas en el mismo mes', icon: '🔁', target: 3 },
  { id: 'cazador_ofertas', name: 'Cazador de Ofertas', xp: 350, cadence: 'historical', category: 'rewards', description: 'Reserva 3 veces con promoción activa', icon: '🏷️', target: 3 },
  { id: 'voz_barrio', name: 'Voz del Barrio', xp: 400, cadence: 'historical', category: 'reviews', description: 'Publica 5 reseñas verificadas', icon: '💬', target: 5 },
  { id: 'fotografo_gourmet', name: 'Fotógrafo Gourmet', xp: 400, cadence: 'historical', category: 'reviews', description: 'Publica 10 reseñas con foto', icon: '📷', target: 10 },
  { id: 'mesa_grande', name: 'Mesa Grande', xp: 400, cadence: 'historical', category: 'loyalty', description: 'Reserva para 5 personas o más', icon: '👨‍👩‍👧‍👦', target: 1 },
  { id: 'explorador_zona', name: 'Explorador de Zona', xp: 450, cadence: 'historical', category: 'exploration', description: 'Visita 5 barrios distintos', icon: '🗺️', target: 5 },
  { id: 'reserva_planificada', name: 'Planificador Pro', xp: 450, cadence: 'historical', category: 'loyalty', description: 'Reserva con 7 días de antelación', icon: '📆', target: 1 },
  { id: 'cazador_tesoros', name: 'Cazador de Tesoros', xp: 400, cadence: 'historical', category: 'rewards', description: 'Canjea 5 premios diferentes', icon: '🗝️', target: 5 },
  { id: 'ruta_internacional', name: 'Ruta Internacional', xp: 500, cadence: 'historical', category: 'exploration', description: '5 gastronomías internacionales distintas', icon: '🌏', target: 5 },
  { id: 'socio_veterano', name: 'Socio Veterano', xp: 1000, cadence: 'historical', category: 'loyalty', description: 'Completa 25 reservas asistidas', icon: '🏅', target: 25 },
  { id: 'embajador_local', name: 'Embajador Local', xp: 900, cadence: 'historical', category: 'exploration', description: 'Visita 20 restaurantes distintos', icon: '🏘️', target: 20 },
  { id: 'maestro_resenas', name: 'Maestro de Reseñas', xp: 950, cadence: 'historical', category: 'reviews', description: 'Publica 20 reseñas detalladas', icon: '🖊️', target: 20 },
  { id: 'critico_destacado', name: 'Crítico Destacado', xp: 800, cadence: 'historical', category: 'reviews', description: 'Publica 25 reseñas detalladas con foto', icon: '⭐', target: 25 },
  { id: 'coleccionista_premios', name: 'Coleccionista', xp: 1000, cadence: 'historical', category: 'rewards', description: 'Canjea 8 premios de fidelización', icon: '💎', target: 8 },
  { id: 'maraton_gastro', name: 'Maratón Gastro', xp: 1200, cadence: 'historical', category: 'loyalty', description: 'Completa 30 reservas asistidas', icon: '🏃', target: 30 },
  { id: 'leyenda_restaurante', name: 'Leyenda del Restaurante', xp: 2000, cadence: 'historical', category: 'loyalty', description: 'Completa 50 reservas asistidas', icon: '👑', target: 50 },
  { id: 'infiltrado_hosteleria', name: 'Infiltrado Hostelería', xp: 1000, cadence: 'historical', category: 'exploration', description: '100 comensales en tus reservas en total', icon: '🕵️', target: 100 },
  { id: 'guia_michelin', name: 'Guía Michelin de Barrio', xp: 1500, cadence: 'historical', category: 'reviews', description: 'Tus reseñas marcadas como útiles 50 veces', icon: '📖', target: 50 },
  { id: 'centurion_mesas', name: 'Centurión de Mesas', xp: 1800, cadence: 'historical', category: 'loyalty', description: 'Completa 100 reservas asistidas', icon: '💯', target: 100 },
  { id: 'oraculo_sabores', name: 'Oráculo de Sabores', xp: 2000, cadence: 'historical', category: 'reviews', description: 'Publica 50 reseñas verificadas', icon: '🔮', target: 50 },
  { id: 'llama_eterna', name: 'Llama Eterna', xp: 2200, cadence: 'historical', category: 'loyalty', description: 'Completa 75 reservas asistidas', icon: '🔥', target: 75 },
  { id: 'corona_gastro', name: 'Corona Gastro', xp: 2800, cadence: 'historical', category: 'exploration', description: 'Visita 40 restaurantes distintos', icon: '👑', target: 40 },
  { id: 'titan_hosteleria', name: 'Titán Hostelería', xp: 2500, cadence: 'historical', category: 'exploration', description: '200 comensales en tus reservas en total', icon: '🌋', target: 200 },
  { id: 'emperador_adelia', name: 'Emperador Adelia', xp: 3000, cadence: 'historical', category: 'loyalty', description: 'Alcanza el nivel 7 de foodie', icon: '🦁', target: 7 },
]

export function allMissionDefinitions(): MissionDefinition[] {
  return [...WEEKLY_MISSIONS, ...MONTHLY_MISSION_POOL, ...HISTORICAL_MISSIONS]
}

export function applyMissionCatalog(missions: MissionDefinition[]): void {
  const weekly = missions.filter((mission) => mission.cadence === 'weekly')
  const monthly = missions.filter((mission) => mission.cadence === 'monthly')
  const historical = missions.filter((mission) => mission.cadence === 'historical')

  if (weekly.length > 0) {
    WEEKLY_MISSIONS = weekly
  }
  if (monthly.length > 0) {
    MONTHLY_MISSION_POOL = monthly
    MONTHLY_MISSIONS = monthly
  }
  if (historical.length > 0) {
    HISTORICAL_MISSIONS = historical
  }
}
