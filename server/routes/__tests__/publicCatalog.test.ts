import { describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('../../firebase-admin.ts', () => ({ adminDb: {} }))

import { plainValue } from '../publicCatalog.ts'

describe('catálogo público en un JSON', () => {
  it('convierte las fechas de Firestore a texto, también dentro de listas y objetos', () => {
    const date = new Date('2026-11-11T10:00:00Z')
    expect(plainValue({
      name: 'Sala',
      updatedAt: Timestamp.fromDate(date),
      caps: { menus: 3, history: [Timestamp.fromDate(date)] },
    })).toEqual({
      name: 'Sala',
      updatedAt: date.toISOString(),
      caps: { menus: 3, history: [date.toISOString()] },
    })
  })
})
