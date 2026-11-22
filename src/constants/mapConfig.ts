import type { GeoCoordinates } from '../utils/geo'

/** Vista inicial centrada en España. */
export const DEFAULT_MAP_CENTER: GeoCoordinates = {
  lat: 40,
  lng: -3.7,
}

export const DEFAULT_MAP_ZOOM = 6
export const LOCATION_MAP_ZOOM = 16

export interface MapTileConfig {
  url: string
  attribution: string
}

export function getMapTileConfig(): MapTileConfig {
  const mapTilerKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim()

  if (mapTilerKey) {
    return {
      url: `https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=${mapTilerKey}`,
      attribution:
        '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }
  }

  return {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
  }
}

/**
 * Mapa base limpio (igual que la app): calles, nombres, parques y agua, sin
 * tiendas, bancos, cafés ni otros negocios. OpenFreeMap, estilo «Positron»:
 * gratis y sin cuenta. Se dibuja con MapLibre dentro de Leaflet, así que los
 * marcadores de nuestros restaurantes siguen igual.
 */
export const CLEAN_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
export const CLEAN_MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
