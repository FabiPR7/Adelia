import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase-admin.ts', () => ({ adminDb: {} }))

const { cleanDisplayName, displayNameError, normalizeUsername, usernameError } = await import('../usernames.ts')

describe('@usuario', () => {
  it('se normaliza: sin @, sin espacios alrededor y en minúsculas', () => {
    expect(normalizeUsername('  @@Ana.Lopez ')).toBe('ana.lopez')
  })

  it('acepta letras, números, punto y guion bajo', () => {
    expect(usernameError('ana_lopez.92')).toBeNull()
  })

  it('rechaza lo que no vale', () => {
    expect(usernameError('an')).toMatch(/entre 3 y 20/)
    expect(usernameError('a'.repeat(21))).toMatch(/entre 3 y 20/)
    expect(usernameError('josé')).toMatch(/sin tilde/)
    expect(usernameError('.ana')).toMatch(/sin empezar/)
    expect(usernameError('ana_')).toMatch(/sin empezar/)
    expect(usernameError('ana..lopez')).toMatch(/seguidos/)
    expect(usernameError('ana lopez')).not.toBeNull()
  })

  it('no deja hacerse pasar por Adelia o soporte', () => {
    expect(usernameError('admin')).toMatch(/reservado/)
    expect(usernameError('soporte')).toMatch(/reservado/)
    expect(usernameError('adelia_oficial')).toMatch(/reservado/)
  })
})

describe('nombre visible', () => {
  it('quita etiquetas y espacios de más', () => {
    expect(cleanDisplayName('  <b>Ana</b>   López ')).toBe('Ana López')
  })
  it('pide al menos 2 letras', () => {
    expect(displayNameError('A')).not.toBeNull()
    expect(displayNameError('12345')).not.toBeNull()
    expect(displayNameError('Ana')).toBeNull()
  })
})
