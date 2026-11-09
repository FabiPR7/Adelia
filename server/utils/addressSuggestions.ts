export interface PhotonAddressFeature {
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    osm_id?: number
    osm_type?: string
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    district?: string
    city?: string
    county?: string
    state?: string
    country?: string
  }
}

export interface AddressSuggestion {
  id: string
  title: string
  subtitle: string
  label: string
  lat: number
  lng: number
}

function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

/** Convierte la respuesta de Photon en sugerencias legibles: «Calle Mayor 3» + «Logroño, La Rioja, España». */
export function parseAddressSuggestions(
  features: PhotonAddressFeature[] | undefined,
  limit: number,
): AddressSuggestion[] {
  const seen = new Set<string>()
  const suggestions: AddressSuggestion[] = []

  for (const feature of features ?? []) {
    const coordinates = feature.geometry?.coordinates
    if (!coordinates || coordinates.length < 2) {
      continue
    }

    const properties = feature.properties ?? {}
    const street = [clean(properties.street), clean(properties.housenumber)].filter(Boolean).join(' ')
    const title = clean(properties.name) || street || clean(properties.city)
    if (!title) {
      continue
    }

    const place = [
      street && street !== title ? street : '',
      clean(properties.district),
      clean(properties.city),
      clean(properties.state),
      clean(properties.country),
    ].filter((part, index, parts) => part && part !== title && parts.indexOf(part) === index)
    const subtitle = place.join(', ')
    const label = subtitle ? `${title}, ${subtitle}` : title

    const dedupeKey = label.toLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)

    const [lng, lat] = coordinates
    suggestions.push({
      id: `${properties.osm_type ?? 'p'}-${properties.osm_id ?? dedupeKey}`,
      title,
      subtitle,
      label,
      lat,
      lng,
    })

    if (suggestions.length >= limit) {
      break
    }
  }

  return suggestions
}
