import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { adelinaCoinUrl } from '../constants/adelina'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getMapTileConfig } from '../constants/mapConfig'
import {
  formatDistanceKm,
  type GeoCoordinates,
} from '../utils/geo'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  formatDiscoveryRatingBadge,
  restaurantsForDiscoveryMap,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import styles from './NearbyRestaurantsMap.module.css'
import 'leaflet/dist/leaflet.css'

const MAP_CARD_SIZE: [number, number] = [96, 104]
const MAP_CARD_ANCHOR: [number, number] = [48, 104]

interface NearbyRestaurantsMapProps {
  restaurants: PublicDiscoveryRestaurant[]
  userCoords: GeoCoordinates | null
  homeCoords: GeoCoordinates | null
  locating: boolean
  locationError: string | null
  selectedSlug?: string | null
  onRequestGps: () => void
  onOpenRestaurant: (restaurant: PublicDiscoveryRestaurant) => void
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function createYouIcon(): L.DivIcon {
  return L.divIcon({
    className: styles.youMarker,
    html: `<span class="${styles.youPulse}" aria-hidden="true"></span><span class="${styles.youDot}" aria-hidden="true"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function createRestaurantCardIcon(
  restaurant: PublicDiscoveryRestaurant & { distanceKm?: number },
  variant: 'default' | 'featured' | 'selected',
): L.DivIcon {
  const photo = restaurant.photoUrl.trim()
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
    : ''
  const name = escapeHtml(restaurant.name)
  const initial = escapeHtml(restaurant.name.charAt(0).toUpperCase() || 'R')
  const rating = formatDiscoveryRatingBadge(restaurant)
  const photoHtml = photo
    ? `<img class="${styles.cardPhotoImg}" src="${escapeHtml(photo)}" alt="" draggable="false" />`
    : `<span class="${styles.cardFallback}">${initial}</span>`
  const ratingHtml = rating
    ? `<span class="${styles.cardRating}"><img class="${styles.cardCoin}" src="${adelinaCoinUrl}" alt="" draggable="false" /><b>${escapeHtml(rating)}</b></span>`
    : ''

  return L.divIcon({
    className: [
      styles.restaurantCard,
      variant === 'featured' ? styles.restaurantCardFeatured : '',
      variant === 'selected' ? styles.restaurantCardSelected : '',
    ].filter(Boolean).join(' '),
    html: `
      <article class="${styles.cardInner}">
        <div class="${styles.cardStack}">
          <div class="${styles.cardPhoto}">
            ${photoHtml}
            <span class="${styles.cardName}">${name}</span>
            ${ratingHtml}
            ${typeof restaurant.distanceKm === 'number' ? `<span class="${styles.cardDistance}">${escapeHtml(formatDistanceKm(restaurant.distanceKm))}</span>` : ''}
          </div>
        </div>
        <span class="${styles.cardPointer}" aria-hidden="true"></span>
      </article>
    `,
    iconSize: MAP_CARD_SIZE,
    iconAnchor: MAP_CARD_ANCHOR,
  })
}

function NearbyRestaurantsMap({
  restaurants,
  userCoords,
  homeCoords,
  locating,
  locationError,
  selectedSlug = null,
  onRequestGps,
  onOpenRestaurant,
}: NearbyRestaurantsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const onOpenRef = useRef(onOpenRestaurant)
  const restaurantsRef = useRef(restaurants)
  const lastFitKeyRef = useRef('')

  onOpenRef.current = onOpenRestaurant
  restaurantsRef.current = restaurants

  const origin = userCoords ?? homeCoords
  const originKind = userCoords ? 'gps' : homeCoords ? 'home' : null

  const nearby = useMemo(
    () => restaurantsForDiscoveryMap(restaurants, origin),
    [origin, restaurants],
  )

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
      zoom: DEFAULT_MAP_ZOOM,
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

    const resize = window.setTimeout(() => {
      map.invalidateSize()
    }, 80)

    return () => {
      window.clearTimeout(resize)
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layerGroup = layerGroupRef.current
    if (!map || !layerGroup) {
      return
    }

    layerGroup.clearLayers()

    if (!origin && nearby.length === 0) {
      lastFitKeyRef.current = ''
      const idleTimer = window.setTimeout(() => {
        map.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_ZOOM)
        map.invalidateSize()
      }, 60)
      return () => window.clearTimeout(idleTimer)
    }

    if (origin) {
      const youMarker = L.marker([origin.lat, origin.lng], {
        icon: createYouIcon(),
        interactive: false,
        zIndexOffset: 1200,
      }).bindTooltip(originKind === 'gps' ? 'Estás aquí' : 'Tu zona', {
        direction: 'top',
        offset: [0, -10],
      })
      layerGroup.addLayer(youMarker)

      L.circle([origin.lat, origin.lng], {
        radius: 900,
        color: '#2563eb',
        weight: 1,
        opacity: 0.35,
        fillColor: '#2563eb',
        fillOpacity: 0.08,
      }).addTo(layerGroup)
    }

    const points: L.LatLngExpression[] = origin ? [[origin.lat, origin.lng]] : []

    nearby.forEach((restaurant, index) => {
      const selected = restaurant.slug === selectedSlug
      const featured = index < 3
      const marker = L.marker(
        [restaurant.latitude as number, restaurant.longitude as number],
        {
          icon: createRestaurantCardIcon(
            restaurant,
            selected ? 'selected' : featured ? 'featured' : 'default',
          ),
          riseOnHover: true,
          zIndexOffset: selected ? 900 : featured ? 500 : 220,
        },
      )

      marker.on('click', () => {
        const current = restaurantsRef.current.find((item) => item.slug === restaurant.slug)
        if (current) {
          onOpenRef.current(current)
        }
      })
      layerGroup.addLayer(marker)
      points.push([restaurant.latitude as number, restaurant.longitude as number])
    })

    const fitKey = `${origin ? `${origin.lat},${origin.lng}` : 'no-origin'}|${nearby.map((item) => item.slug).join(',')}`
    const shouldFit = lastFitKeyRef.current !== fitKey
    lastFitKeyRef.current = fitKey

    const frameTimer = window.setTimeout(() => {
      map.invalidateSize()
      if (!shouldFit) {
        return
      }
      if (points.length === 0) {
        return
      }
      if (points.length === 1) {
        map.setView(points[0], 14)
        return
      }
      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [20, 72],
        paddingBottomRight: [20, 28],
        maxZoom: 15,
        animate: true,
      })
    }, 80)

    return () => window.clearTimeout(frameTimer)
  }, [nearby, origin, originKind, selectedSlug])

  const hasOrigin = Boolean(origin)
  const subtitle = nearby.length === 0
    ? hasOrigin
      ? 'Con estos filtros no hay locales con ubicación cerca.'
      : 'Activa la ubicación para verte en el mapa, o mira los locales con pin.'
    : hasOrigin
      ? originKind === 'gps'
        ? `${nearby.length} ${nearby.length === 1 ? 'local' : 'locales'} cerca de ti.`
        : `${nearby.length} ${nearby.length === 1 ? 'local' : 'locales'} cerca de tu zona.`
      : `${nearby.length} ${nearby.length === 1 ? 'local' : 'locales'} en el mapa.`

  return (
    <section className={styles.section} aria-labelledby="nearby-map-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Cerca tuyo</p>
          <h2 id="nearby-map-title">Mapa de tu alrededor</h2>
          <p className={styles.lead}>{subtitle}</p>
        </div>
        <button
          type="button"
          className={styles.gpsButton}
          onClick={onRequestGps}
          disabled={locating}
        >
          {locating ? 'Ubicando…' : userCoords ? 'Actualizar GPS' : 'Usar mi ubicación'}
        </button>
      </header>

      <div className={styles.mapCard}>
        <div
          ref={mapContainerRef}
          className={styles.map}
          aria-label="Mapa con tu ubicación y restaurantes cercanos"
        />

        {!hasOrigin && nearby.length === 0 ? (
          <div className={styles.overlay}>
            <p>Para ver dónde estás y qué hay cerca, permite tu ubicación o completa tu zona en el perfil.</p>
            <button type="button" className={styles.overlayButton} onClick={onRequestGps} disabled={locating}>
              {locating ? 'Buscando…' : 'Mostrar cerca de mí'}
            </button>
          </div>
        ) : null}

        {locating ? <div className={styles.loading}>Obteniendo tu ubicación…</div> : null}
      </div>

      {locationError ? <p className={styles.error}>{locationError}</p> : null}
    </section>
  )
}

export default NearbyRestaurantsMap
