import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { adelinaCoinUrl } from '../constants/adelina'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getMapTileConfig } from '../constants/mapConfig'
import {
  DISCOVERY_NEARBY_MAX_KM,
  formatDistanceKm,
  type GeoCoordinates,
} from '../utils/geo'
import { CLOUDINARY_DISPLAY, optimizeCloudinaryUrl } from '../utils/cloudinaryUrl'
import {
  formatDiscoveryRatingBadge,
  getDiscoveryAverageRating,
  pickNearbyRestaurants,
  type PublicDiscoveryRestaurant,
} from '../utils/publicDiscovery'
import { getAdelinaSlotStates } from '../types/review'
import styles from './NearbyRestaurantsMap.module.css'
import 'leaflet/dist/leaflet.css'

const MAP_CARD_SIZE: [number, number] = [84, 102]
const MAP_CARD_ANCHOR: [number, number] = [42, 102]

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
  restaurant: PublicDiscoveryRestaurant & { distanceKm: number },
  variant: 'default' | 'featured' | 'selected',
): L.DivIcon {
  const photo = restaurant.photoUrl.trim()
    ? optimizeCloudinaryUrl(restaurant.photoUrl, CLOUDINARY_DISPLAY.photoThumb)
    : ''
  const name = escapeHtml(restaurant.name)
  const initial = escapeHtml(restaurant.name.charAt(0).toUpperCase() || 'R')
  const rating = formatDiscoveryRatingBadge(restaurant)
  const slots = getAdelinaSlotStates(
    getDiscoveryAverageRating(restaurant),
    restaurant.reviewCount,
  )
  const coinsHtml = slots
    .map((state) => (
      `<img class="${state === 'full' ? styles.coinOn : styles.coinOff}" src="${adelinaCoinUrl}" alt="" draggable="false" />`
    ))
    .join('')
  const photoHtml = photo
    ? `<img class="${styles.cardPhotoImg}" src="${escapeHtml(photo)}" alt="" draggable="false" />`
    : `<span class="${styles.cardFallback}">${initial}</span>`
  const ratingHtml = rating
    ? `<b>${escapeHtml(rating)}</b>`
    : `<span>Nueva</span>`

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
            <span class="${styles.cardDistance}">${escapeHtml(formatDistanceKm(restaurant.distanceKm))}</span>
          </div>
          <div class="${styles.cardBody}">
            <strong>${name}</strong>
            <span class="${styles.cardAdelinas}">
              <span class="${styles.cardCoins}">${coinsHtml}</span>
              ${ratingHtml}
            </span>
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

  const nearby = useMemo(() => {
    if (!origin) {
      return []
    }
    return pickNearbyRestaurants(restaurants, origin, DISCOVERY_NEARBY_MAX_KM)
  }, [origin, restaurants])

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

    if (!origin) {
      lastFitKeyRef.current = ''
      const idleTimer = window.setTimeout(() => {
        map.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], DEFAULT_MAP_ZOOM)
        map.invalidateSize()
      }, 60)
      return () => window.clearTimeout(idleTimer)
    }

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

    const points: L.LatLngExpression[] = [[origin.lat, origin.lng]]

    nearby.slice(0, 12).forEach((restaurant, index) => {
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

    const fitKey = `${origin.lat},${origin.lng}|${nearby.map((item) => item.slug).join(',')}`
    const shouldFit = lastFitKeyRef.current !== fitKey
    lastFitKeyRef.current = fitKey

    const frameTimer = window.setTimeout(() => {
      map.invalidateSize()
      if (!shouldFit) {
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
  const subtitle = !hasOrigin
    ? 'Activa la ubicación para verte en el mapa y resaltar los locales de alrededor.'
    : nearby.length === 0
      ? 'Aún no hay restaurantes con ubicación cerca de este punto.'
      : originKind === 'gps'
        ? `${nearby.length} ${nearby.length === 1 ? 'restaurante' : 'restaurantes'} cerca de ti.`
        : `${nearby.length} ${nearby.length === 1 ? 'restaurante' : 'restaurantes'} cerca de tu zona.`

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

        {!hasOrigin ? (
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

      {nearby.length > 0 ? (
        <ul className={styles.list}>
          {nearby.slice(0, 6).map((restaurant, index) => (
            <li key={restaurant.slug}>
              <button
                type="button"
                className={`${styles.listItem} ${restaurant.slug === selectedSlug ? styles.listItemActive : ''}`}
                onClick={() => onOpenRestaurant(restaurant)}
              >
                <span className={styles.listRank}>{index + 1}</span>
                <span className={styles.listCopy}>
                  <strong>{restaurant.name}</strong>
                  <span>{restaurant.municipality || restaurant.location || 'Cerca'}</span>
                </span>
                <b>{formatDistanceKm(restaurant.distanceKm)}</b>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.legend}>
        <span><i className={styles.legendYou} /> Tú</span>
        <span><i className={styles.legendPlace} /> Tarjeta del restaurante</span>
      </p>
    </section>
  )
}

export default NearbyRestaurantsMap
