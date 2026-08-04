import type { CitySuggestion } from '../services/citySearch'

export function municipalityToCitySuggestion(
  municipality: string,
  country: string,
): CitySuggestion | null {
  const name = municipality.trim()
  const countryName = country.trim()

  if (!name) {
    return null
  }

  return {
    id: `saved-${name}-${countryName}`,
    name,
    region: '',
    country: countryName,
    label: countryName ? `${name}, ${countryName}` : name,
  }
}

export function isConfirmedCitySelection(
  selectedCity: CitySuggestion | null,
  municipality: string,
): boolean {
  return Boolean(selectedCity && selectedCity.name.trim() === municipality.trim())
}
