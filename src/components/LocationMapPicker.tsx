import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  getMapTileConfig,
  LOCATION_MAP_ZOOM,
} from '../constants/mapConfig'
import { geocodePlace } from '../services/geocoding'
import type { GeoCoordinates } from '../utils/geo'
import styles from './LocationMapPicker.module.css'
import 'leaflet/dist/leaflet.css'

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface LocationMapPickerProps {
  value: GeoCoordinates | null
  onChange: (coords: GeoCoordinates) => void
  geocodeQuery?: string
  disabled?: boolean
  compact?: boolean
  square?: boolean
}

function LocationMapPicker({
  value,
  onChange,
  geocodeQuery = '',
  disabled = false,
  compact = false,
  square = false,
}: LocationMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const disabledRef = useRef(disabled)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
      zoom: DEFAULT_MAP_ZOOM,
      scrollWheelZoom: true,
    })

    const tiles = getMapTileConfig()
    L.tileLayer(tiles.url, {
      attribution: tiles.attribution,
      maxZoom: 19,
    }).addTo(map)

    const placeMarker = (coords: GeoCoordinates, draggable: boolean) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([coords.lat, coords.lng])
        markerRef.current.dragging?.[draggable ? 'enable' : 'disable']()
        return
      }

      markerRef.current = L.marker([coords.lat, coords.lng], {
        draggable,
        icon: defaultIcon,
      }).addTo(map)

      markerRef.current.on('dragend', () => {
        const marker = markerRef.current

        if (!marker) {
          return
        }

        const { lat, lng } = marker.getLatLng()
        onChangeRef.current({ lat, lng })
      })
    }

    map.on('click', (event) => {
      if (disabledRef.current) {
        return
      }

      const coords = { lat: event.latlng.lat, lng: event.latlng.lng }
      placeMarker(coords, true)
      onChangeRef.current(coords)
      setStatusMessage('Ubicación marcada. Puedes arrastrar el pin para afinar.')
    })

    mapRef.current = map
    window.setTimeout(() => {
      map.invalidateSize()
    }, 80)
    window.setTimeout(() => {
      map.invalidateSize()
    }, 280)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      map.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_ZOOM)
      return
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng])
      markerRef.current.dragging?.[disabled ? 'disable' : 'enable']()
    } else {
      markerRef.current = L.marker([value.lat, value.lng], {
        draggable: !disabled,
        icon: defaultIcon,
      }).addTo(map)

      markerRef.current.on('dragend', () => {
        const marker = markerRef.current

        if (!marker) {
          return
        }

        const { lat, lng } = marker.getLatLng()
        onChangeRef.current({ lat, lng })
      })
    }

    map.setView([value.lat, value.lng], Math.max(map.getZoom(), LOCATION_MAP_ZOOM))
  }, [disabled, value])

  const handleUseMyLocation = () => {
    if (disabled || !navigator.geolocation) {
      setStatusMessage('Tu navegador no puede obtener la ubicación.')
      return
    }

    setIsBusy(true)
    setStatusMessage('Obteniendo tu ubicación…')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        onChange(coords)
        setStatusMessage('Pin colocado en tu ubicación actual.')
        setIsBusy(false)
      },
      () => {
        setStatusMessage('No pudimos obtener tu ubicación. Marca el pin manualmente.')
        setIsBusy(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const handleGeocodeAddress = async () => {
    const query = geocodeQuery.trim()

    if (!query) {
      setStatusMessage('Completa dirección y municipio antes de buscar.')
      return
    }

    setIsBusy(true)
    setStatusMessage('Buscando dirección…')

    try {
      const coords = await geocodePlace(query)

      if (!coords) {
        setStatusMessage('No encontramos esa dirección. Marca el pin en el mapa.')
        return
      }

      onChange(coords)
      setStatusMessage('Dirección encontrada. Ajusta el pin si hace falta.')
    } catch {
      setStatusMessage('No pudimos buscar la dirección. Marca el pin manualmente.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className={`${styles.root} ${compact ? styles.rootCompact : ''} ${square ? styles.rootSquare : ''}`}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => void handleGeocodeAddress()}
          disabled={disabled || isBusy}
        >
          Buscar dirección
        </button>
        <button
          type="button"
          className={styles.toolButton}
          onClick={handleUseMyLocation}
          disabled={disabled || isBusy}
        >
          Usar mi GPS
        </button>
      </div>

      <div
        ref={mapContainerRef}
        className={`${styles.map} ${compact ? styles.mapCompact : ''} ${square ? styles.mapSquare : ''}`}
        aria-label="Mapa para marcar la ubicación del restaurante"
      />

      {square ? null : (
        <p className={styles.hint}>
          Toca el mapa o arrastra el pin para indicar la entrada exacta de tu local.
        </p>
      )}

      {statusMessage && <p className={styles.status}>{statusMessage}</p>}

      {value && (
        <p className={styles.coords}>
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  )
}

export default LocationMapPicker
