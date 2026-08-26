import type { MissionDefinition } from '../types/gamification'

/**
 * Las misiones de visita (reserva, consumo, gasto, bar/restaurante) comparten
 * `rotationGroup: 'visit'` para que en la misma semana solo salga UNA.
 * Así un solo ticket no completa 5 retos a la vez.
 */
export let WEEKLY_MISSIONS: MissionDefinition[] = [
  {
    id: 'reserva_confirmada_semana',
    name: 'Mesa con Reserva',
    xp: 60,
    cadence: 'weekly',
    description: 'Completa 1 visita con reserva confirmada',
    icon: '📅',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'reserva_obligatoria_semana',
    name: 'Solo con Reserva',
    xp: 80,
    cadence: 'weekly',
    description: 'Completa una reserva en un local que solo atiende con reserva',
    icon: '🗓️',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'consumo_sin_reserva_semana',
    name: 'Plan Espontáneo',
    xp: 70,
    cadence: 'weekly',
    description: 'Registra 1 consumo verificado sin reserva',
    icon: '🧾',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'consumo_productos_semana',
    name: 'Carta Probada',
    xp: 85,
    cadence: 'weekly',
    description: 'Verifica un consumo eligiendo productos de la carta',
    icon: '🍽️',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'gasto_minimo_semana',
    name: 'Objetivo de Gasto',
    xp: 90,
    cadence: 'weekly',
    description: 'Supera el gasto mínimo de una promoción',
    icon: '💳',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'ticket_30_semana',
    name: 'Ticket de 30 €',
    xp: 85,
    cadence: 'weekly',
    description: 'Verifica un consumo de al menos 30 €',
    icon: '💶',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'visita_bar_semana',
    name: 'Ruta de Bar',
    xp: 70,
    cadence: 'weekly',
    description: 'Completa una visita verificada en un bar',
    icon: '🍻',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'visita_restaurante_semana',
    name: 'Mesa de Restaurante',
    xp: 70,
    cadence: 'weekly',
    description: 'Completa una visita verificada en un restaurante',
    icon: '🍴',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'promo_consumo_semana',
    name: 'Promo al Paso',
    xp: 80,
    cadence: 'weekly',
    category: 'rewards',
    description: 'Registra un consumo sin reserva usando una promoción',
    icon: '🏷️',
    target: 1,
    rotationGroup: 'visit',
  },
  {
    id: 'reserva_anticipada',
    name: 'Reserva Anticipada',
    xp: 55,
    cadence: 'weekly',
    description: 'Haz una reserva con al menos 3 días de antelación',
    icon: '🗓️',
    target: 1,
    rotationGroup: 'planning',
  },
  {
    id: 'mesa_compartida_semana',
    name: 'Mesa Compartida',
    xp: 80,
    cadence: 'weekly',
    description: 'Completa 2 reservas para 3 o más personas',
    icon: '👥',
    target: 2,
    rotationGroup: 'group_booking',
  },
  {
    id: 'fiel_seguidor',
    name: 'Fiel Seguidor',
    xp: 45,
    cadence: 'weekly',
    description: 'Guarda 3 locales nuevos en favoritos',
    icon: '♥',
    target: 3,
    rotationGroup: 'favorite',
  },
  {
    id: 'critico_foto',
    name: 'El Crítico con Foto',
    xp: 70,
    cadence: 'weekly',
    category: 'reviews',
    description: 'Sube 1 reseña con foto tras tu visita',
    icon: 'adelina-review',
    target: 1,
    rotationGroup: 'photo_review',
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
    rotationGroup: 'text_review',
  },
]

export let MONTHLY_MISSION_POOL: MissionDefinition[] = [
  {
    id: 'reservas_mes',
    name: 'Agenda Gastronómica',
    xp: 280,
    cadence: 'monthly',
    description: 'Completa 3 visitas con reserva confirmada',
    icon: '📅',
    target: 3,
    rotationGroup: 'booking',
  },
  {
    id: 'consumos_mes',
    name: 'Mes Espontáneo',
    xp: 280,
    cadence: 'monthly',
    description: 'Registra 3 consumos verificados sin reserva',
    icon: '🧾',
    target: 3,
    rotationGroup: 'consumption',
  },
  {
    id: 'gastos_minimos_mes',
    name: 'Cazador de Mínimos',
    xp: 300,
    cadence: 'monthly',
    category: 'rewards',
    description: 'Supera 2 gastos mínimos en el mes',
    icon: '💳',
    target: 2,
    rotationGroup: 'spend',
  },
  {
    id: 'gasto_acumulado_mes',
    name: '100 € de Ruta',
    xp: 320,
    cadence: 'monthly',
    description: 'Acumula 100 € en consumos verificados',
    icon: '💶',
    target: 100,
    rotationGroup: 'spend',
  },
  {
    id: 'bar_y_restaurante_mes',
    name: 'De Barra y Mantel',
    xp: 300,
    cadence: 'monthly',
    description: 'Completa 1 visita en un bar y 1 en un restaurante',
    icon: '🍻',
    target: 2,
    rotationGroup: 'venue',
  },
  {
    id: 'productos_mes',
    name: 'Explorador de Carta',
    xp: 290,
    cadence: 'monthly',
    description: 'Verifica 3 consumos seleccionando productos de la carta',
    icon: '🍽️',
    target: 3,
    rotationGroup: 'consumption',
  },
  {
    id: 'dos_modalidades_mes',
    name: 'Con Plan y Sin Plan',
    xp: 310,
    cadence: 'monthly',
    description: 'Completa 1 visita con reserva y 1 consumo sin reserva',
    icon: '🔀',
    target: 2,
    rotationGroup: 'mixed',
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
    rotationGroup: 'community',
  },
]

/** @deprecated Usar rotateMonthlyMissions() para obtener las misiones activas del mes. */
export let MONTHLY_MISSIONS = MONTHLY_MISSION_POOL

export let HISTORICAL_MISSIONS: MissionDefinition[] = [
  { id: 'debut_gastronomico', name: 'Primera Reserva', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Completa tu primera reserva confirmada', icon: '🎉', target: 1 },
  { id: 'primer_consumo_libre', name: 'Primer Consumo Libre', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Registra tu primer consumo sin reserva', icon: '🧾', target: 1 },
  { id: 'corazon_favorito', name: 'Corazón Favorito', xp: 150, cadence: 'historical', category: 'loyalty', description: 'Guarda tu primer restaurante favorito', icon: '❤️', target: 1 },
  { id: 'primera_opinion', name: 'Primera Opinión', xp: 100, cadence: 'historical', category: 'reviews', description: 'Publica tu primera reseña verificada', icon: '✍️', target: 1 },
  { id: 'primer_botin', name: 'Primer Botín', xp: 150, cadence: 'historical', category: 'rewards', description: 'Canjea tu primer premio de fidelización', icon: '🎁', target: 1 },
  { id: 'primer_gasto_minimo', name: 'Tres Mínimos', xp: 250, cadence: 'historical', category: 'rewards', description: 'Supera 3 gastos mínimos', icon: '💳', target: 3 },
  { id: 'primera_carta_productos', name: 'Carta al Detalle', xp: 250, cadence: 'historical', category: 'loyalty', description: 'Verifica 3 consumos eligiendo productos de la carta', icon: '🍽️', target: 3 },
  { id: 'ruta_de_bar', name: 'Ruta de Bares', xp: 280, cadence: 'historical', category: 'exploration', description: 'Completa 3 visitas verificadas en bares', icon: '🍻', target: 3 },
  { id: 'ruta_de_restaurante', name: 'Ruta de Restaurantes', xp: 280, cadence: 'historical', category: 'exploration', description: 'Completa 3 visitas verificadas en restaurantes', icon: '🍴', target: 3 },
  { id: 'consumidor_habitual', name: 'Consumidor Habitual', xp: 320, cadence: 'historical', category: 'loyalty', description: 'Registra 5 consumos sin reserva', icon: '🧾', target: 5 },
  { id: 'cazador_minimos', name: 'Cazador de Mínimos', xp: 350, cadence: 'historical', category: 'rewards', description: 'Supera 5 gastos mínimos', icon: '💳', target: 5 },
  { id: 'cliente_fiel_meson', name: 'Cliente Fiel del Mesón', xp: 300, cadence: 'historical', category: 'loyalty', description: 'Completa la tarjeta de fidelidad en un local', icon: '🃏', target: 1 },
  { id: 'nomada_digital', name: 'Nómada Digital', xp: 300, cadence: 'historical', category: 'exploration', description: 'Visita 10 locales distintos', icon: '🌍', target: 10 },
  { id: 'club_10_mesas', name: 'Club de las 10 Mesas', xp: 500, cadence: 'historical', category: 'loyalty', description: 'Completa 10 visitas con reserva', icon: '🪑', target: 10 },
  { id: 'cazador_ofertas', name: 'Cazador de Ofertas', xp: 350, cadence: 'historical', category: 'rewards', description: 'Completa 3 visitas con promoción', icon: '🏷️', target: 3 },
  { id: 'voz_barrio', name: 'Voz del Barrio', xp: 400, cadence: 'historical', category: 'reviews', description: 'Publica 5 reseñas verificadas', icon: '💬', target: 5 },
  { id: 'fotografo_gourmet', name: 'Fotógrafo Gourmet', xp: 400, cadence: 'historical', category: 'reviews', description: 'Publica 10 reseñas con foto', icon: '📷', target: 10 },
  { id: 'mesa_grande', name: 'Mesa Grande', xp: 400, cadence: 'historical', category: 'loyalty', description: 'Reserva para 5 personas o más', icon: '👨‍👩‍👧‍👦', target: 1 },
  { id: 'explorador_zona', name: 'Explorador de Zona', xp: 450, cadence: 'historical', category: 'exploration', description: 'Visita 5 barrios distintos', icon: '🗺️', target: 5 },
  { id: 'cazador_tesoros', name: 'Cazador de Tesoros', xp: 400, cadence: 'historical', category: 'rewards', description: 'Canjea 5 premios diferentes', icon: '🗝️', target: 5 },
  { id: 'ruta_internacional', name: 'Ruta Internacional', xp: 500, cadence: 'historical', category: 'exploration', description: '5 gastronomías internacionales distintas', icon: '🌏', target: 5 },
  { id: 'socio_veterano', name: 'Socio Veterano', xp: 1000, cadence: 'historical', category: 'loyalty', description: 'Completa 25 visitas con reserva', icon: '🏅', target: 25 },
  { id: 'embajador_local', name: 'Embajador Local', xp: 900, cadence: 'historical', category: 'exploration', description: 'Visita 20 locales distintos', icon: '🏘️', target: 20 },
  { id: 'maestro_resenas', name: 'Maestro de Reseñas', xp: 950, cadence: 'historical', category: 'reviews', description: 'Publica 20 reseñas detalladas', icon: '🖊️', target: 20 },
  { id: 'critico_destacado', name: 'Crítico Destacado', xp: 800, cadence: 'historical', category: 'reviews', description: 'Publica 25 reseñas detalladas con foto', icon: '⭐', target: 25 },
  { id: 'coleccionista_premios', name: 'Coleccionista', xp: 1000, cadence: 'historical', category: 'rewards', description: 'Canjea 8 premios de fidelización', icon: '💎', target: 8 },
  { id: 'maraton_gastro', name: 'Maratón Gastro', xp: 1200, cadence: 'historical', category: 'loyalty', description: 'Completa 30 visitas con reserva', icon: '🏃', target: 30 },
  { id: 'leyenda_restaurante', name: 'Leyenda del Restaurante', xp: 2000, cadence: 'historical', category: 'loyalty', description: 'Completa 50 visitas con reserva', icon: '👑', target: 50 },
  { id: 'infiltrado_hosteleria', name: 'Infiltrado Hostelería', xp: 1000, cadence: 'historical', category: 'exploration', description: '100 comensales en tus reservas en total', icon: '🕵️', target: 100 },
  { id: 'guia_michelin', name: 'Guía Michelin de Barrio', xp: 1500, cadence: 'historical', category: 'reviews', description: 'Tus reseñas marcadas como útiles 50 veces', icon: '📖', target: 50 },
  { id: 'centurion_mesas', name: 'Centurión de Mesas', xp: 1800, cadence: 'historical', category: 'loyalty', description: 'Completa 100 visitas con reserva', icon: '💯', target: 100 },
  { id: 'oraculo_sabores', name: 'Oráculo de Sabores', xp: 2000, cadence: 'historical', category: 'reviews', description: 'Publica 50 reseñas verificadas', icon: '🔮', target: 50 },
  { id: 'llama_eterna', name: 'Llama Eterna', xp: 2200, cadence: 'historical', category: 'loyalty', description: 'Completa 75 visitas con reserva', icon: '🔥', target: 75 },
  { id: 'corona_gastro', name: 'Corona Gastro', xp: 2800, cadence: 'historical', category: 'exploration', description: 'Visita 40 locales distintos', icon: '👑', target: 40 },
  { id: 'titan_hosteleria', name: 'Titán Hostelería', xp: 2500, cadence: 'historical', category: 'exploration', description: '200 comensales en tus reservas en total', icon: '🌋', target: 200 },
  { id: 'emperador_adelia', name: 'Emperador Adelia', xp: 3000, cadence: 'historical', category: 'loyalty', description: 'Alcanza el nivel 7 de foodie', icon: '🦁', target: 7 },
]

export function allMissionDefinitions(): MissionDefinition[] {
  return [...WEEKLY_MISSIONS, ...MONTHLY_MISSION_POOL, ...HISTORICAL_MISSIONS]
}

export function applyMissionCatalog(missions: MissionDefinition[]): void {
  const remoteById = new Map(missions.map((mission) => [mission.id, mission]))
  const overlayKnownMissions = (local: MissionDefinition[]) => local.map((mission) => {
    const remote = remoteById.get(mission.id)
    return remote
      ? { ...mission, ...remote, rotationGroup: mission.rotationGroup }
      : mission
  })

  WEEKLY_MISSIONS = overlayKnownMissions(WEEKLY_MISSIONS)
  MONTHLY_MISSION_POOL = overlayKnownMissions(MONTHLY_MISSION_POOL)
  MONTHLY_MISSIONS = MONTHLY_MISSION_POOL
  HISTORICAL_MISSIONS = overlayKnownMissions(HISTORICAL_MISSIONS)
}
