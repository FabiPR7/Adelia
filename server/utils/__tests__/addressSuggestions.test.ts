import { describe, expect, it } from 'vitest'
import { parseAddressSuggestions } from '../addressSuggestions.ts'

describe('parseAddressSuggestions', () => {
  it('builds a readable title and place line for each result', () => {
    const suggestions = parseAddressSuggestions(
      [
        {
          geometry: { coordinates: [-2.445, 42.466] },
          properties: {
            osm_type: 'W',
            osm_id: 1,
            street: 'Calle Mayor',
            housenumber: '3',
            city: 'Logroño',
            state: 'La Rioja',
            country: 'España',
          },
        },
      ],
      5,
    )

    expect(suggestions).toEqual([
      {
        id: 'W-1',
        title: 'Calle Mayor 3',
        subtitle: 'Logroño, La Rioja, España',
        label: 'Calle Mayor 3, Logroño, La Rioja, España',
        lat: 42.466,
        lng: -2.445,
      },
    ])
  })

  it('skips results without coordinates or name and removes duplicates', () => {
    const city = {
      geometry: { coordinates: [-2.44, 42.46] as [number, number] },
      properties: { name: 'Logroño', state: 'La Rioja', country: 'España' },
    }

    const suggestions = parseAddressSuggestions(
      [city, { ...city }, { properties: { name: 'Sin coordenadas' } }, { geometry: { coordinates: [0, 0] } }],
      5,
    )

    expect(suggestions.map((item) => item.label)).toEqual(['Logroño, La Rioja, España'])
  })

  it('respects the limit', () => {
    const features = ['A', 'B', 'C'].map((name, index) => ({
      geometry: { coordinates: [index, index] as [number, number] },
      properties: { name },
    }))

    expect(parseAddressSuggestions(features, 2)).toHaveLength(2)
  })
})
