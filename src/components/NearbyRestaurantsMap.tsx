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
import {
  MAP_MARKER_DIMENSIONS,
  markerSizeForGap,
  nearestNeighborDistances,
  promoTierForCount,
  type MapMarkerSize,
  type MapPromoTier,
} from '../utils/mapMarkerLayout'
import styles from './NearbyRestaurantsMap.module.css'
import 'leaflet/dist/leaflet.css'

const SIZE_CLASS: Record<MapMarkerSize, string> = {
  large: '',
  medium: styles.sizeMedium,
  small: styles.sizeSmall,
}

const PROMO_CLASS: Record<MapPromoTier, string> = {
  0: '',
  1: styles.promoTier1,
  2: styles.promoTier2,
  3: styles.promoTier3,
}

interface PlacedMarker {
  marker: L.Marker
  restaurant: PublicDiscoveryRestaurant & { distanceKm?: number }
  selected: boolean
  featured: boolean
}

/** Icono «utensils-crossed» de lucide, en texto porque los marcadores de Leaflet son HTML. */
const UTENSILS_ICON_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/></svg>'

interface NearbyRestaurantsMapProps {
  restaurants: PublicDiscoveryRestaurant[]
  userCoords: GeoCoordinates | null
  homeCoords: GeoCoordinates | null
  locating: boolean
  locationError: string | null
  selectedSlug?: string | null
  /** Solo el mapa: quien lo usa pone su propia cabecera y controles. */
  bare?: boolean
  /** Promociones activas por id de restaurante: cuantas más, más destaca en el mapa. */
  promoCounts?: Record<string, number>
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
  size: MapMarkerSize,
  promoCount: number,
): L.DivIcon {
  const promoTier = promoTierForCount(promoCount)
  const dimensions = MAP_MARKER_DIMENSIONS[size]
  const promoBadgeHtml = promoTier >= 2
    ? `<span class="${styles.promoBadge}" title="${promoCount} promociones">${promoCount}</span>`
    : ''
  const photo = restaurant.photoUrl.trim()
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
    : ''
  const name = escapeHtml(restaurant.name)
  const rating = formatDiscoveryRatingBadge(restaurant)
  const photoHtml = photo
    ? `<img class="${styles.cardPhotoImg}" src="${escapeHtml(photo)}" alt="" draggable="false" />`
    : `<span class="${styles.cardFallback}">${UTENSILS_ICON_SVG}</span>`
  const ratingHtml = rating
    ? `<span class="${styles.cardRating}"><img class="${styles.cardCoin}" src="${adelinaCoinUrl}" alt="" draggable="false" /><b>${escapeHtml(rating)}</b></span>`
    : ''

  return L.divIcon({
    className: [
      styles.restaurantCard,
      SIZE_CLASS[size],
      PROMO_CLASS[promoTier],
      variant === 'selected' ? styles.restaurantCardSelected : '',
    ].filter(Boolean).join(' '),
    html: `
      <article class="${styles.cardInner}">
        ${promoBadgeHtml}
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
    iconSize: dimensions.size,
    iconAnchor: dimensions.anchor,
  })
}

function NearbyRestaurantsMap({
  restaurants,
  userCoords,
  homeCoords,
  locating,
  locationError,
  selectedSlug = null,
  bare = false,
  promoCounts,
  onRequestGps,
  onOpenRestaurant,
}: NearbyRestaurantsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const onOpenRef = useRef(onOpenRestaurant)
  const restaurantsRef = useRef(restaurants)
  const lastFitKeyRef = useRef('')
  const placedMarkersRef = useRef<PlacedMarker[]>([])
  const restyleMarkersRef = useRef<() => void>(() => {})

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
    // Al cambiar el zoom cambia la separación en pantalla: se recalcula el tamaño de cada tarjeta.
    map.on('zoomend', () => restyleMarkersRef.current())

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
    const placed: PlacedMarker[] = []

    nearby.forEach((restaurant, index) => {
      const selected = restaurant.slug === selectedSlug
      const featured = index < 3
      const promoCount = promoCounts?.[restaurant.id] ?? 0
      const marker = L.marker(
        [restaurant.latitude as number, restaurant.longitude as number],
        {
          icon: createRestaurantCardIcon(
            restaurant,
            selected ? 'selected' : featured ? 'featured' : 'default',
            'large',
            promoCount,
          ),
          riseOnHover: true,
          // Los que tienen más promociones quedan por encima de los demás.
          zIndexOffset: selected ? 900 : 220 + promoTierForCount(promoCount) * 120 + (featured ? 40 : 0),
        },
      )

      marker.on('click', () => {
        const current = restaurantsRef.current.find((item) => item.slug === restaurant.slug)
        if (current) {
          onOpenRef.current(current)
        }
      })
      layerGroup.addLayer(marker)
      placed.push({ marker, restaurant, selected, featured })
      points.push([restaurant.latitude as number, restaurant.longitude as number])
    })

    placedMarkersRef.current = placed
    restyleMarkersRef.current = () => {
      const current = placedMarkersRef.current
      if (current.length === 0) {
        return
      }

      const gaps = nearestNeighborDistances(
        current.map(({ marker }) => map.latLngToContainerPoint(marker.getLatLng())),
      )

      current.forEach(({ marker, restaurant, selected, featured }, index) => {
        const size = selected ? 'large' : markerSizeForGap(gaps[index])
        marker.setIcon(
          createRestaurantCardIcon(
            restaurant,
            selected ? 'selected' : featured ? 'featured' : 'default',
            size,
            promoCounts?.[restaurant.id] ?? 0,
          ),
        )
        marker.unbindTooltip()
        if (size === 'small') {
          marker.bindTooltip(restaurant.name, {
            direction: 'top',
            offset: [0, -MAP_MARKER_DIMENSIONS.small.size[1]],
          })
        }
      })
    }
    restyleMarkersRef.current()

    const fitKey = `${origin ? `${origin.lat},${origin.lng}` : 'no-origin'}|${nearby.map((item) => item.slug).join(',')}`
    const shouldFit = lastFitKeyRef.current !== fitKey

    const frameTimer = window.setTimeout(() => {
      map.invalidateSize()
      if (!shouldFit) {
        return
      }
      if (points.length === 0) {
        return
      }
      // Se marca al encuadrar, no antes: si el efecto se repite y cancela
      // este temporizador, la siguiente pasada tiene que volver a intentarlo.
      lastFitKeyRef.current = fitKey
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
  }, [nearby, origin, originKind, selectedSlug, promoCounts])

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

  const mapCard = (
    <div className={`${styles.mapCard} ${bare ? styles.mapCardFill : ''}`}>
      <div
        ref={mapContainerRef}
        className={`${styles.map} ${bare ? styles.mapFill : ''}`}
        aria-label="Mapa con tu ubicación y restaurantes cercanos"
      />

      {!bare && !hasOrigin && nearby.length === 0 ? (
        <div className={styles.overlay}>
          <p>Para ver dónde estás y qué hay cerca, permite tu ubicación o completa tu zona en el perfil.</p>
          <button type="button" className={styles.overlayButton} onClick={onRequestGps} disabled={locating}>
            {locating ? 'Buscando…' : 'Mostrar cerca de mí'}
          </button>
        </div>
      ) : null}

      {locating ? <div className={styles.loading}>Obteniendo tu ubicación…</div> : null}
    </div>
  )

  if (bare) {
    return mapCard
  }

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

      {mapCard}

      {locationError ? <p className={styles.error}>{locationError}</p> : null}
    </section>
  )
}

export default NearbyRestaurantsMap
