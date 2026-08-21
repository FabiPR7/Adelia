/**
 * Tipos para amenities/características de restaurantes
 */

export type RestaurantType = 'bar' | 'cafeteria' | 'restaurante'

export interface RestaurantAmenities {
  // Servicios
  hasParking: boolean
  acceptsCreditCard: boolean
  acceptsCash: boolean
  hasRestrooms: boolean
  isAccessible: boolean
  hasTerrace: boolean
  hasWifi: boolean
  petsAllowed: boolean
  
  // Tipos de establecimiento (pueden ser múltiples)
  types: RestaurantType[]
}

export const DEFAULT_AMENITIES: RestaurantAmenities = {
  hasParking: false,
  acceptsCreditCard: true,
  acceptsCash: true,
  hasRestrooms: true,
  isAccessible: false,
  hasTerrace: false,
  hasWifi: false,
  petsAllowed: false,
  types: ['restaurante'],
}

export interface AmenityConfig {
  key: keyof Omit<RestaurantAmenities, 'types'>
  label: string
  icon: string
  iconDisabled: string // Emoji o icono para estado deshabilitado
}

export const AMENITY_CONFIGS: AmenityConfig[] = [
  {
    key: 'hasParking',
    label: 'Parking',
    icon: '🅿️',
    iconDisabled: '🚫',
  },
  {
    key: 'acceptsCreditCard',
    label: 'Tarjeta',
    icon: '💳',
    iconDisabled: '🚫',
  },
  {
    key: 'acceptsCash',
    label: 'Efectivo',
    icon: '💵',
    iconDisabled: '🚫',
  },
  {
    key: 'hasRestrooms',
    label: 'Baños',
    icon: '🚻',
    iconDisabled: '🚫',
  },
  {
    key: 'isAccessible',
    label: 'Accesible',
    icon: '♿',
    iconDisabled: '🚫',
  },
  {
    key: 'hasTerrace',
    label: 'Terraza',
    icon: '☀️',
    iconDisabled: '🚫',
  },
  {
    key: 'hasWifi',
    label: 'WiFi',
    icon: '📶',
    iconDisabled: '🚫',
  },
  {
    key: 'petsAllowed',
    label: 'Mascotas',
    icon: '🐕',
    iconDisabled: '🚫',
  },
]

export const RESTAURANT_TYPE_CONFIGS = [
  { value: 'bar' as RestaurantType, label: 'Bar', icon: '🍺' },
  { value: 'cafeteria' as RestaurantType, label: 'Cafetería', icon: '☕' },
  { value: 'restaurante' as RestaurantType, label: 'Restaurante', icon: '🍽️' },
]
