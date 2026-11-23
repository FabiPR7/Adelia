import L from 'leaflet'
import { setWorkerUrl } from 'maplibre-gl'
// MapLibre 6 dibuja con una pieza aparte (worker): hay que decirle dónde está para
// que Vite la incluya al publicar la web.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@maplibre/maplibre-gl-leaflet'
import { CLEAN_MAP_ATTRIBUTION, CLEAN_MAP_STYLE_URL } from '../constants/mapConfig'

setWorkerUrl(maplibreWorkerUrl)

/** Pone el mapa base limpio (sin negocios) en un mapa de Leaflet. */
export function addCleanBaseMap(map: L.Map): void {
  const layer = (L as unknown as {
    maplibreGL: (options: { style: string; attribution: string }) => L.Layer
  }).maplibreGL({ style: CLEAN_MAP_STYLE_URL, attribution: CLEAN_MAP_ATTRIBUTION })
  layer.addTo(map)
}
