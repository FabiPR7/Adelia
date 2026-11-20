import { describe, expect, it } from 'vitest'
import { buildAuditEntry } from '../auditEntry.ts'

describe('buildAuditEntry', () => {
  it('registra solo los campos que cambian, con antes y después', () => {
    const entry = buildAuditEntry(
      'reservations/r1',
      { status: 'completed', pax: 2, updatedAt: 1 },
      { status: 'confirmed', pax: 2, updatedAt: 2, updatedBy: 'company:c1' },
    )
    expect(entry).toMatchObject({
      collection: 'reservations',
      docId: 'r1',
      action: 'update',
      changedFields: ['status', 'updatedBy'],
      before: { status: 'completed' },
      after: { status: 'confirmed', updatedBy: 'company:c1' },
      actor: 'updatedBy:company:c1',
    })
  })

  it('crear y borrar', () => {
    expect(buildAuditEntry('friendRequests/f1', null, { fromUid: 'a', toUid: 'b' })?.action).toBe('create')
    expect(buildAuditEntry('friendRequests/f1', { fromUid: 'a' }, null)?.action).toBe('delete')
  })

  it('subcolecciones de un local', () => {
    expect(buildAuditEntry('companies/c1/promotions/p1', null, { title: '2x1' })?.collection).toBe('promotions')
  })

  it('no registra ruido ni el propio registro, ni cambios vacíos', () => {
    expect(buildAuditEntry('auditLog/x', null, { a: 1 })).toBeNull()
    expect(buildAuditEntry('rateLimits/x', null, { a: 1 })).toBeNull()
    expect(buildAuditEntry('users/u1', { a: 1, updatedAt: 1 }, { a: 1, updatedAt: 2 })).toBeNull()
  })

  it('nunca copia secretos', () => {
    const entry = buildAuditEntry('companies/c1/private/promotionPin', { pin: '1234' }, { pin: '9999' })
    expect(entry?.before).toEqual({ pin: '[oculto]' })
    expect(entry?.after).toEqual({ pin: '[oculto]' })
  })
})
