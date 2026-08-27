import { describe, expect, it } from 'vitest'
import { resolveSafeRedirect, unauthenticatedPathForRole } from '../authProfile'

describe('resolveSafeRedirect', () => {
  it('acepta rutas internas relativas', () => {
    expect(resolveSafeRedirect('/app/explorar')).toBe('/app/explorar')
    expect(resolveSafeRedirect('/reservar/casa-luna')).toBe('/reservar/casa-luna')
  })

  it('rechaza open redirects', () => {
    expect(resolveSafeRedirect('https://evil.com')).toBeNull()
    expect(resolveSafeRedirect('//evil.com')).toBeNull()
    expect(resolveSafeRedirect('/\\evil.com')).toBeNull()
    expect(resolveSafeRedirect('/cuenta/entrar?next=https://evil.com')).toBeNull()
    expect(resolveSafeRedirect('/\tevil')).toBeNull()
    expect(resolveSafeRedirect('javascript:alert(1)')).toBeNull()
    expect(resolveSafeRedirect(null)).toBeNull()
    expect(resolveSafeRedirect('')).toBeNull()
  })
})

describe('unauthenticatedPathForRole', () => {
  it('manda empresas y admins al login de restaurante', () => {
    expect(unauthenticatedPathForRole('admin')).toBe('/login')
    expect(unauthenticatedPathForRole('company')).toBe('/login')
  })

  it('manda clientes al login de comensales', () => {
    expect(unauthenticatedPathForRole('customer')).toBe('/cuenta/entrar')
  })
})
