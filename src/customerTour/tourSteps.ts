export const TOUR_TARGET = {
  carousel: 'tour-carousel',
  restaurantActions: 'tour-restaurant-actions',
  restaurantBack: 'tour-restaurant-back',
  promosTypes: 'tour-promos-types',
  promosFeed: 'tour-promos-feed',
  reservasTabs: 'tour-reservas-tabs',
  reservasConsumo: 'tour-reservas-consumo',
  misionesArena: 'tour-misiones-arena',
  misionesList: 'tour-misiones-list',
  misionesItems: 'tour-misiones-items',
  misionesCompite: 'tour-misiones-compite',
} as const

export type TourStepId =
  | 'carousel'
  | 'restaurant-actions'
  | 'restaurant-back'
  | 'promos-types'
  | 'promos-feed'
  | 'reservas-tabs'
  | 'reservas-consumo'
  | 'misiones-arena'
  | 'misiones-list'
  | 'misiones-items'
  | 'misiones-compite'

export interface TourStepConfig {
  id: TourStepId
  targetId: string
  title: string
  body?: string
  allowTargetClick: boolean
  primaryLabel?: string
  /** Padding uniforme alrededor del target. */
  pad?: number
  padTop?: number
  padBottom?: number
  padX?: number
  /** Ajuste fino del spotlight (px). En móvil el top medido a veces va ~26px bajo. */
  shiftTop?: number
  shiftLeft?: number
  /** Ruta a la que debe estar la app en este paso. */
  route?: string
}

export const TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'carousel',
    targetId: TOUR_TARGET.carousel,
    title: 'Elige un restaurante',
    body: 'Desliza y toca cualquiera para ver su ficha.',
    allowTargetClick: true,
    pad: 12,
    route: '/app/explorar',
  },
  {
    id: 'restaurant-actions',
    targetId: TOUR_TARGET.restaurantActions,
    title: 'Carta, promos y reserva',
    body: 'Desde aquí abres el menú, las ofertas o pides mesa.',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    padTop: 0,
    padBottom: 0,
    padX: 0,
    // El getBoundingClientRect viene ~26px más abajo de lo que se ve; corregido a ojo (422 → 396).
    shiftTop: -26,
  },
  {
    id: 'restaurant-back',
    targetId: TOUR_TARGET.restaurantBack,
    title: 'Volver al inicio',
    body: 'Con este botón regresas a explorar cuando quieras.',
    allowTargetClick: true,
    primaryLabel: 'Volver',
    pad: 6,
  },
  {
    id: 'promos-types',
    targetId: TOUR_TARGET.promosTypes,
    title: 'Tipos de promociones',
    body: 'Puntuales (tiempo o asistencia) y de fidelidad (por reservas o consumos). Filtra arriba para ver solo un tipo.',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    pad: 8,
    route: '/app/promociones',
  },
  {
    id: 'promos-feed',
    targetId: TOUR_TARGET.promosFeed,
    title: 'Cómo funcionan',
    body: 'En curso son las que ya estás cumpliendo. Cerca de ti, las que puedes activar ahora.',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    pad: 10,
    route: '/app/promociones',
  },
  {
    id: 'reservas-tabs',
    targetId: TOUR_TARGET.reservasTabs,
    title: 'Reservas y consumo',
    body: 'Cambia entre tus mesas (por ir / hechas) y el historial de consumo verificado.',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    pad: 8,
    route: '/app/reservas',
  },
  {
    id: 'reservas-consumo',
    targetId: TOUR_TARGET.reservasConsumo,
    title: 'Registrar un consumo',
    body: 'Elige el restaurante y el local valida con su PIN. Así cuentan visitas y promos sin inventar tickets.',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    pad: 10,
    route: '/app/reservas',
  },
  {
    id: 'misiones-arena',
    targetId: TOUR_TARGET.misionesArena,
    title: 'Tu arena',
    body: 'Tres zonas: Misiones, Ítems que ganas y Compite (ranking).',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    pad: 8,
    route: '/app/misiones',
  },
  {
    id: 'misiones-list',
    targetId: TOUR_TARGET.misionesList,
    title: 'Misiones',
    body: 'Retos de semana, mes y logros. Completa visitas y gana XP y premios.',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    pad: 10,
    route: '/app/misiones',
  },
  {
    id: 'misiones-items',
    targetId: TOUR_TARGET.misionesItems,
    title: 'Ítems',
    body: 'Aquí guardas las cartas y útiles que ganas. Algunos se usan en el local.',
    allowTargetClick: false,
    primaryLabel: 'Continuar',
    pad: 10,
    route: '/app/misiones',
  },
  {
    id: 'misiones-compite',
    targetId: TOUR_TARGET.misionesCompite,
    title: 'Compite',
    body: 'Compara con amigos o sube en el ranking de tu país y mundial.',
    allowTargetClick: false,
    primaryLabel: 'Empezar',
    pad: 10,
    route: '/app/misiones',
  },
]
