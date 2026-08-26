import type { PromotionType } from '../types/company'
import promoHeroDining from '../assets/promo-hero-dining.webp'
import promoCardGourmet from '../assets/promo-card-gourmet.webp'
import promoCardDessert from '../assets/promo-card-dessert.webp'

export interface FeaturedPromotion {
  id: string
  type: PromotionType
  title: string
  description: string
  detail: string
  highlight: string
  restaurantName: string
  imageUrl: string
  accent: 'coral' | 'gold' | 'magenta' | 'sunset'
}

export const FEATURED_PROMOTIONS: FeaturedPromotion[] = [
  {
    id: 'ladder-3',
    type: 'reservation_ladder',
    title: 'Postre GRATIS',
    description: '3 reservas en el mismo sitio y el postre corre de nuestra cuenta.',
    detail: '3 reservas o consumos',
    highlight: 'GRATIS',
    restaurantName: 'La Brasa del Mar',
    imageUrl: promoCardDessert,
    accent: 'magenta',
  },
  {
    id: 'time-lunch',
    type: 'time_limited',
    title: 'Mediodía -20%',
    description: 'Entre semana de 13:00 a 16:00. Solo quedan unas pocas plazas.',
    detail: '12 plazas',
    highlight: '-20%',
    restaurantName: 'Trattoria Roma',
    imageUrl: promoCardGourmet,
    accent: 'gold',
  },
  {
    id: 'ladder-5',
    type: 'reservation_ladder',
    title: 'Menú del chef',
    description: 'Llega a 5 reservas y desbloquea la experiencia degustación completa.',
    detail: '5 reservas o consumos',
    highlight: 'VIP',
    restaurantName: 'Sala Negra',
    imageUrl: promoHeroDining,
    accent: 'sunset',
  },
  {
    id: 'time-copa',
    type: 'time_limited',
    title: 'Copa de bienvenida',
    description: 'Reserva cena jueves a sábado y brindamos contigo la primera ronda.',
    detail: 'Esta semana',
    highlight: '2×1',
    restaurantName: 'Bodega Central',
    imageUrl: promoCardGourmet,
    accent: 'coral',
  },
]

export const PROMO_HERO_IMAGE = promoHeroDining
