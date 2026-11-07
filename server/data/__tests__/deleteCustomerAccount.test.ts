import { beforeEach, describe, expect, it, vi } from 'vitest'

type Data = Record<string, unknown>

const fake = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  authUser: null as { emailVerified: boolean; email: string } | null,
  deletedAuthUsers: [] as string[],
}))

vi.mock('../../firebase-admin.ts', async () => {
  const { FieldValue: Field } = await import('firebase-admin/firestore')

  const docRef = (path: string): any => ({
    id: path.split('/').pop(),
    path,
    parent: {
      parent: path.split('/').length >= 4 ? { id: path.split('/').at(-3) } : null,
    },
    collection: (name: string) => query(() => true, `${path}/${name}`),
    get: async () => snapshot(path),
    set: async (data: Data) => {
      fake.docs.set(path, { ...fake.docs.get(path), ...data })
    },
    delete: async () => {
      fake.docs.delete(path)
    },
  })

  const snapshot = (path: string) => ({
    id: path.split('/').pop(),
    ref: docRef(path),
    exists: fake.docs.has(path),
    data: () => fake.docs.get(path),
  })

  const matchesCollection = (path: string, prefix: string) => {
    const parts = path.split('/')
    return parts.slice(0, -1).join('/') === prefix
  }

  function query(filter: (path: string, data: Data) => boolean, prefix: string | null, group?: string): any {
    return {
      doc: (id: string) => docRef(`${prefix}/${id}`),
      where: (field: string, op: string, value: unknown) => query(
        (path, data) => filter(path, data) && (
          op === 'array-contains'
            ? Array.isArray(data[field]) && (data[field] as unknown[]).includes(value)
            : data[field] === value
        ),
        prefix,
        group,
      ),
      limit: (max: number) => ({
        get: async () => {
          const docs = [...fake.docs.entries()]
            .filter(([path]) => (
              group ? path.split('/').at(-2) === group : matchesCollection(path, prefix as string)
            ))
            .filter(([path, data]) => filter(path, data))
            .slice(0, max)
            .map(([path]) => snapshot(path))
          return { empty: docs.length === 0, size: docs.length, docs }
        },
      }),
    }
  }

  const applyUpdate = (path: string, data: Data) => {
    const next: Data = { ...fake.docs.get(path) }
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'isEqual' in value && (value as any).isEqual(Field.delete())) {
        delete next[key]
      } else {
        next[key] = value
      }
    }
    fake.docs.set(path, next)
  }

  return {
    adminDb: {
      collection: (name: string) => query(() => true, name),
      collectionGroup: (name: string) => query(() => true, null, name),
      batch: () => {
        const ops: Array<() => void> = []
        return {
          update: (ref: { path: string }, data: Data) => ops.push(() => applyUpdate(ref.path, data)),
          delete: (ref: { path: string }) => ops.push(() => fake.docs.delete(ref.path)),
          commit: async () => ops.forEach((op) => op()),
        }
      },
      recursiveDelete: async (ref: { path: string }) => {
        for (const path of [...fake.docs.keys()]) {
          if (path === ref.path || path.startsWith(`${ref.path}/`)) {
            fake.docs.delete(path)
          }
        }
      },
    },
    adminAuth: {
      getUser: async () => fake.authUser,
      deleteUser: async (uid: string) => {
        fake.deletedAuthUsers.push(uid)
      },
    },
  }
})

import { deleteCustomerAccount } from '../deleteCustomerAccount.ts'

const EMAIL = 'cliente@correo.test'

describe('deleteCustomerAccount', () => {
  beforeEach(() => {
    fake.docs.clear()
    fake.deletedAuthUsers.length = 0
    fake.authUser = { emailVerified: true, email: EMAIL }
    fake.docs.set('users/u1', { role: 'customer', email: EMAIL })
    fake.docs.set('users/u1/notifications/n1', { title: 'aviso' })
    fake.docs.set('userGamification/u1', { xp: 10 })
    fake.docs.set('reservations/linked', { companyId: 'c1', customerUid: 'u1', clientName: 'Ana', clientEmail: EMAIL, clientPhone: '600' })
    fake.docs.set('reservations/email-only', { companyId: 'c2', clientName: 'Ana', clientEmail: EMAIL, clientPhone: '600' })
    fake.docs.set('reservations/other', { companyId: 'c1', clientName: 'Luis', clientEmail: 'luis@correo.test' })
    fake.docs.set(`companies/c1/clients/${EMAIL}`, { name: 'Ana', phone: '600' })
    fake.docs.set(`companies/c2/clients/${EMAIL}`, { name: 'Ana', phone: '600' })
    fake.docs.set(`companies/c3/clients/${EMAIL}`, { name: 'Ana' })
    fake.docs.set('companies/c1/clients/luis@correo.test', { name: 'Luis' })
    fake.docs.set('companies/c3/verifiedConsumptions/v1', { customerUid: 'u1', clientName: 'Ana', clientEmail: EMAIL, totalCents: 1500 })
  })

  it('anonymizes reservations linked by account and by verified email', async () => {
    await deleteCustomerAccount('u1')

    for (const id of ['linked', 'email-only']) {
      const reservation = fake.docs.get(`reservations/${id}`)!
      expect(reservation.clientName).toBe('Cliente eliminado')
      expect(reservation.clientEmail).toBe('')
      expect(reservation.clientPhone).toBe('')
      expect(reservation.customerUid).toBeUndefined()
    }
    expect(fake.docs.get('reservations/other')?.clientName).toBe('Luis')
  })

  it('removes the client record from every restaurant and keeps other clients', async () => {
    await deleteCustomerAccount('u1')

    expect(fake.docs.has(`companies/c1/clients/${EMAIL}`)).toBe(false)
    expect(fake.docs.has(`companies/c2/clients/${EMAIL}`)).toBe(false)
    expect(fake.docs.has(`companies/c3/clients/${EMAIL}`)).toBe(false)
    expect(fake.docs.has('companies/c1/clients/luis@correo.test')).toBe(true)
  })

  it('anonymizes verified consumptions but keeps the amounts', async () => {
    await deleteCustomerAccount('u1')

    const consumption = fake.docs.get('companies/c3/verifiedConsumptions/v1')!
    expect(consumption.clientName).toBe('Cliente eliminado')
    expect(consumption.clientEmail).toBe('')
    expect(consumption.customerUid).toBeUndefined()
    expect(consumption.totalCents).toBe(1500)
  })

  it('does not touch data of an email the account has not verified', async () => {
    fake.authUser = { emailVerified: false, email: EMAIL }

    await deleteCustomerAccount('u1')

    expect(fake.docs.get('reservations/email-only')?.clientName).toBe('Ana')
    expect(fake.docs.has(`companies/c2/clients/${EMAIL}`)).toBe(true)
  })

  it('removes the profile, its subcollections and the auth user', async () => {
    await deleteCustomerAccount('u1')

    expect(fake.docs.has('users/u1')).toBe(false)
    expect(fake.docs.has('users/u1/notifications/n1')).toBe(false)
    expect(fake.docs.has('userGamification/u1')).toBe(false)
    expect(fake.deletedAuthUsers).toEqual(['u1'])
  })

  it('rejects accounts that are not customers', async () => {
    fake.docs.set('users/u1', { role: 'company' })

    await expect(deleteCustomerAccount('u1')).rejects.toThrow('comensal')
  })
})
