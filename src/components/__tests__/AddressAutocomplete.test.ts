import { describe, expect, it } from 'vitest'
import { pickAddress } from '../AddressAutocomplete'
import { looksLikeStreet } from '../../utils/addressQuery'

describe('pickAddress', () => {
  const tricio = {
    id: 'W-1',
    title: 'Calle Tricio',
    subtitle: 'Madre de Dios, Logroño, La Rioja, España',
    label: 'Calle Tricio, Madre de Dios, Logroño, La Rioja, España',
    lat: 42.467,
    lng: -2.44,
    street: 'Calle Tricio',
    houseNumber: '',
    postalCode: '26003',
    city: 'Logroño',
    region: 'La Rioja',
    country: 'España',
  }

  it('rellena ciudad, código postal, país y mapa, y conserva el número escrito', () => {
    expect(pickAddress(tricio, 'calle tricio 1')).toEqual({
      line: 'Calle Tricio, 1',
      postalCode: '26003',
      city: 'Logroño',
      region: 'La Rioja',
      country: 'España',
      lat: 42.467,
      lng: -2.44,
    })
  })

  it('usa el número del mapa si lo trae', () => {
    expect(pickAddress({ ...tricio, houseNumber: '7' }, 'calle tricio').line).toBe('Calle Tricio, 7')
  })

  it('con respuestas antiguas sin partes, usa el título', () => {
    const old = { id: 'x', title: 'Hostel', subtitle: 'Logroño', label: 'Hostel, Logroño', lat: 1, lng: 2 }
    expect(pickAddress(old, 'hostel').line).toBe('Hostel')
  })
})

describe('looksLikeStreet', () => {
  it('detecta calles y números, no ciudades', () => {
    expect(looksLikeStreet('calle portales 12')).toBe(true)
    expect(looksLikeStreet('Avenida de la Paz')).toBe(true)
    expect(looksLikeStreet('Logroño')).toBe(false)
    expect(looksLikeStreet('Callosa')).toBe(false)
  })
})
