import { describe, expect, it } from 'vitest'
import { staffAuthEmailCandidates } from '../../../server/auth/staffAuthEmails.ts'

describe('staffAuthEmailCandidates', () => {
  it('resuelve nombre de admin/empresa a emails de Auth', () => {
    expect(staffAuthEmailCandidates('Fabian')).toEqual([
      'fabian@adelia.app',
      'fabian@adeliareservas.com',
    ])
  })

  it('acepta el email escrito en el campo nombre', () => {
    expect(staffAuthEmailCandidates('fabian@adelia.app')).toEqual([
      'fabian@adelia.app',
      'fabian-adelia-app@adelia.app',
      'fabian-adelia-app@adeliareservas.com',
    ])
  })
})
