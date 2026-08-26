import { describe, expect, it } from 'vitest'
import { assertNoSecretFields, hasForbiddenSecretField, omitSecretFields } from '../secretFields'
import { requireAuthPassword } from '../passwordValidation'
import { monthBounds, yearBounds } from '../../services/firestoreQuery'

describe('secretFields', () => {
  it('detects leftover password fields', () => {
    expect(hasForbiddenSecretField({ loginName: 'Casa', loginPassword: 'secret' })).toBe(true)
    expect(hasForbiddenSecretField({ loginName: 'Casa', authEmail: 'a@b.c' })).toBe(false)
  })

  it('strips secrets before a Firestore write', () => {
    expect(omitSecretFields({
      loginName: 'Casa',
      loginPassword: 'plain',
      password: 'plain',
      authEmail: 'casa@adelia.app',
    })).toEqual({
      loginName: 'Casa',
      authEmail: 'casa@adelia.app',
    })
  })

  it('refuses to persist a password in Firestore', () => {
    expect(() => assertNoSecretFields({ password: 'Adelia2026' }, 'users')).toThrow(/Firebase Auth/)
  })
})

describe('requireAuthPassword', () => {
  it('only sends a strong password to Firebase Auth', () => {
    expect(() => requireAuthPassword('123456')).toThrow()
    expect(requireAuthPassword('AdeliaCasa1')).toBe('AdeliaCasa1')
  })
})

describe('firestoreQuery ranges', () => {
  it('builds exclusive month and year bounds', () => {
    expect(monthBounds(new Date(2026, 7, 21))).toEqual({
      start: new Date(2026, 7, 1),
      end: new Date(2026, 8, 1),
    })
    expect(yearBounds(2026)).toEqual({
      start: new Date(2026, 0, 1),
      end: new Date(2027, 0, 1),
    })
  })
})
