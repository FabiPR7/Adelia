import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { getMapTileConfig } from '../../constants/mapConfig'
import { geocodePlace } from '../../services/geocoding'
import {
  buildGoogleMapsDirectionsUrl,
  estimateTravelMinutes,
  formatDistanceKm,
  formatTravelMinutes,
  haversineDistanceKm,
  type GeoCoordinates,
} from '../../utils/geo'
import { getLocationErrorMessage, requestUserLocation } from '../../utils/requestUserLocation'
import styles from './RestaurantRouteMapModal.module.css'
import 'leaflet/dist/leaflet.css'

interface RestaurantRouteMapModalProps {
  isOpen: boolean
  onClose: () => void
  restaurantName: string
  addressQuery: string
  restaurantCoords: GeoCoordinates | null
  cityFallback?: string
}

function createDotIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span aria-hidden="true" style="
      display:flex;align-items:center;justify-content:center;
      width:18px;height:18px;border-radius:999px;
      background:${color};border:2px solid #fff;
      box-shadow:0 4px 12px rgba(0,0,0,0.28);
    " title="${label}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export default function RestaurantRouteMapModal({
  isOpen,
  onClose,
  restaurantName,
  addressQuery,
  restaurantCoords,
  cityFallback = '',
}: RestaurantRouteMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userCoords, setUserCoords] = useState<GeoCoordinates | null>(null)
  const [destinationCoords, setDestinationCoords] = useState<GeoCoordinates | null>(restaurantCoords)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      setDistanceKm(null)

      try {
        const [location, destination] = await Promise.all([
          requestUserLocation(cityFallback),
          (async () => {
            if (restaurantCoords) {
              return restaurantCoords
            }

            const query = addressQuery.trim()
            if (!query) {
              return null
            }

            return geocodePlace(query)
          })(),
        ])

        if (cancelled) {
          return
        }

        if (!destination) {
          setError('No encontramos la ubicación del restaurante.')
          setUserCoords(location.coords)
          setDestinationCoords(null)
          return
        }

        setUserCoords(location.coords)
        setDestinationCoords(destination)
        setDistanceKm(haversineDistanceKm(location.coords, destination))
      } catch (locationError) {
        if (!cancelled) {
          setError(getLocationErrorMessage(locationError, Boolean(cityFallback.trim())))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [addressQuery, cityFallback, isOpen, restaurantCoords])

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) {
      return undefined
    }

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
        zoomControl: true,
      })

      const tiles = getMapTileConfig()
      L.tileLayer(tiles.url, {
        attribution: tiles.attribution,
        maxZoom: 19,
      }).addTo(map)

      layerGroupRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layerGroupRef.current = null
      }
    }
  }, [isOpen])

  useEffect(() => {
    const map = mapRef.current
    const layerGroup = layerGroupRef.current

    if (!isOpen || !map || !layerGroup || !userCoords || !destinationCoords) {
      return
    }

    layerGroup.clearLayers()

    const userMarker = L.marker([userCoords.lat, userCoords.lng], {
      icon: createDotIcon('#2563eb', 'Tu ubicación'),
    }).bindTooltip('Tú', { permanent: false, direction: 'top' })

    const destinationMarker = L.marker([destinationCoords.lat, destinationCoords.lng], {
      icon: createDotIcon('#c45c3e', restaurantName),
    }).bindTooltip(restaurantName, { permanent: false, direction: 'top' })

    const routeLine = L.polyline(
      [
        [userCoords.lat, userCoords.lng],
        [destinationCoords.lat, destinationCoords.lng],
      ],
      {
        color: '#2563eb',
        weight: 4,
        opacity: 0.75,
        dashArray: '8 8',
      },
    )

    layerGroup.addLayer(routeLine)
    layerGroup.addLayer(userMarker)
    layerGroup.addLayer(destinationMarker)

    const bounds = L.latLngBounds([
      [userCoords.lat, userCoords.lng],
      [destinationCoords.lat, destinationCoords.lng],
    ])

    window.setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(bounds.pad(0.22), { maxZoom: 15 })
    }, 80)
  }, [destinationCoords, isOpen, restaurantName, userCoords])

  if (!isOpen) {
    return null
  }

  const drivingMinutes = distanceKm != null ? estimateTravelMinutes(distanceKm, 'driving') : null
  const walkingMinutes = distanceKm != null ? estimateTravelMinutes(distanceKm, 'walking') : null
  const mapsUrl =
    userCoords && destinationCoords
      ? buildGoogleMapsDirectionsUrl(userCoords, destinationCoords, 'driving')
      : null

  return (
    <div className={styles.page} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-map-title"
      >
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <h2 id="route-map-title">Cómo llegar</h2>
            <p>{restaurantName}</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className={styles.mapWrap}>
          <div ref={mapContainerRef} className={styles.map} aria-label="Mapa con tu ubicación y el restaurante" />
          {isLoading ? <div className={styles.loadingOverlay}>Calculando ruta…</div> : null}
        </div>

        {distanceKm != null && drivingMinutes != null && walkingMinutes != null ? (
          <div className={styles.stats}>
            <div className={styles.stat}>
              <strong>{formatDistanceKm(distanceKm)}</strong>
              <span>Distancia</span>
            </div>
            <div className={styles.stat}>
              <strong>{formatTravelMinutes(drivingMinutes)}</strong>
              <span>En coche</span>
            </div>
            <div className={styles.stat}>
              <strong>{formatTravelMinutes(walkingMinutes)}</strong>
              <span>A pie</span>
            </div>
          </div>
        ) : null}

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendYou}`} />
            Tú
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendDest}`} />
            Restaurante
          </span>
        </div>

        {error ? <p className={styles.errorMessage}>{error}</p> : null}

        <div className={styles.actions}>
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.primaryAction}
            >
              Abrir en Google Maps
            </a>
          ) : null}
          <button type="button" className={styles.secondaryAction} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
