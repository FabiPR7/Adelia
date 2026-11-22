import L from 'leaflet'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@maplibre/maplibre-gl-leaflet'
import { CLEAN_MAP_ATTRIBUTION, CLEAN_MAP_STYLE_URL } from '../constants/mapConfig'

/** Pone el mapa base limpio (sin negocios) en un mapa de Leaflet. */
export function addCleanBaseMap(map: L.Map): void {
  const layer = (L as unknown as {
    maplibreGL: (options: { style: string; attribution: string }) => L.Layer
  }).maplibreGL({ style: CLEAN_MAP_STYLE_URL, attribution: CLEAN_MAP_ATTRIBUTION })
  layer.addTo(map)
}
