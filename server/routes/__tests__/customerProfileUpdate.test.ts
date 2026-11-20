import { describe, expect, it } from 'vitest'
import { buildProfileUpdate } from '../customerProfileUpdate.ts'

describe('buildProfileUpdate', () => {
  it('acepta solo los campos permitidos y válidos', () => {
    expect(buildProfileUpdate({
      phone: '+34 612 345 678',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/x.jpg',
      homeCity: 'Logroño',
      homeLatitude: 42.46,
      homeLongitude: -2.44,
      foodPreferences: ['Tapas', 'Tapas', 'Sushi'],
      onboardingCompleted: true,
      xp: 999999,
      role: 'admin',
    })).toEqual({
      phone: '+34 612 345 678',
      photoUrl: 'https://res.cloudinary.com/demo/image/upload/x.jpg',
      homeCity: 'Logroño',
      homeLatitude: 42.46,
      homeLongitude: -2.44,
      foodPreferences: ['Tapas', 'Sushi'],
      onboardingCompleted: true,
    })
  })

  it('rechaza fotos de otros sitios, teléfonos raros y coordenadas imposibles', () => {
    expect(() => buildProfileUpdate({ photoUrl: 'https://malo.example/x.jpg' })).toThrow('La foto no es válida.')
    expect(() => buildProfileUpdate({ phone: 'hola' })).toThrow('El teléfono no es válido.')
    expect(() => buildProfileUpdate({ homeLatitude: 200 })).toThrow('La ubicación no es válida.')
    expect(() => buildProfileUpdate({ savedPromotionIds: ['../../x'] })).toThrow('Las promos guardadas no son válidas.')
    expect(() => buildProfileUpdate({ onboardingCompleted: false })).toThrow('Valor no válido.')
  })

  it('deja borrar la foto o el teléfono', () => {
    expect(buildProfileUpdate({ photoUrl: '', phone: '' })).toEqual({ photoUrl: '', phone: '' })
  })
})
