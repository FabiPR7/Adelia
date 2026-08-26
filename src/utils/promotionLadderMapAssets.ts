import type { LadderMapThemeId } from './promotionLadderMapThemes'

export function loadLadderMapThemeImage(id: LadderMapThemeId): Promise<string> {
  switch (id) {
    case 'island':
      return import('../assets/maps/map-theme-island.webp').then((mod) => mod.default)
    case 'volcano':
      return import('../assets/maps/map-theme-volcano.webp').then((mod) => mod.default)
    case 'forest':
      return import('../assets/maps/map-theme-forest.webp').then((mod) => mod.default)
    case 'desert':
      return import('../assets/maps/map-theme-desert.webp').then((mod) => mod.default)
    case 'space':
      return import('../assets/maps/map-theme-space.webp').then((mod) => mod.default)
    default: {
      const _exhaustive: never = id
      return Promise.reject(new Error(`Tema de mapa desconocido: ${_exhaustive}`))
    }
  }
}
