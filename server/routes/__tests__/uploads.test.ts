import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase-admin.ts', () => ({ adminAuth: { verifyIdToken: vi.fn() } }))

import { signCloudinaryParams } from '../uploads.ts'
import { parseSecurityConfig, DEFAULT_SECURITY_CONFIG } from '../../security/securityConfig.ts'

describe('firma de Cloudinary', () => {
  it('coincide con el ejemplo de la documentación de Cloudinary', () => {
    // https://cloudinary.com/documentation/authentication_signatures
    expect(signCloudinaryParams({ timestamp: 1315060510, public_id: 'sample_image' }, 'abcd'))
      .toBe('b4ad47fb4e25c7bf5f92a20089f9db59bc302313')
  })

  it('ordena los parámetros antes de firmar', () => {
    const a = signCloudinaryParams({ folder: 'x', timestamp: 1 }, 's')
    const b = signCloudinaryParams({ timestamp: 1, folder: 'x' }, 's')
    expect(a).toBe(b)
  })
})

describe('ajustes de seguridad de la base de datos', () => {
  it('sin documento usa los valores seguros por defecto', () => {
    expect(parseSecurityConfig(undefined)).toEqual(DEFAULT_SECURITY_CONFIG)
  })

  it('ignora valores fuera de rango', () => {
    expect(parseSecurityConfig({ guestBookingMinScore: 5, maxBookingDaysAhead: -3, guestBookingCaptcha: 'sí' }))
      .toEqual(DEFAULT_SECURITY_CONFIG)
  })

  it('respeta lo que se ponga en la base de datos', () => {
    expect(parseSecurityConfig({ guestBookingCaptcha: false, guestBookingMinScore: 0.3, maxBookingDaysAhead: 60 }))
      .toEqual({ guestBookingCaptcha: false, guestBookingMinScore: 0.3, maxBookingDaysAhead: 60 })
  })
})
