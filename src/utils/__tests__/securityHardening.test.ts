import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { authKey, clientKey, hashRateKey } from '../../../server/security/requestIdentity.ts'
import { isAllowedOrigin } from '../../../server/security/origins.ts'
import { settleMinDuration } from '../../../server/security/timing.ts'
import { asOptionalCustomerPhotoUrl, InputError } from '../../../server/security/validate.ts'
import type { Request } from 'express'

function fakeReq(partial: Partial<Request>): Request {
  return partial as Request
}

describe('request identity', () => {
  it('usa req.ip y no el primer X-Forwarded-For', () => {
    const req = fakeReq({
      ip: '203.0.113.9',
      headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' },
      socket: { remoteAddress: '10.0.0.1' } as Request['socket'],
    })
    expect(clientKey(req)).toBe('203.0.113.9')
  })

  it('distingue tokens JWT que comparten cabecera', () => {
    const header = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.'
    const tokenA = `${header}aaa.${'a'.repeat(40)}`
    const tokenB = `${header}bbb.${'b'.repeat(40)}`
    const reqA = fakeReq({ headers: { authorization: `Bearer ${tokenA}` }, ip: '1.1.1.1' })
    const reqB = fakeReq({ headers: { authorization: `Bearer ${tokenB}` }, ip: '1.1.1.1' })
    expect(authKey(reqA)).not.toBe(authKey(reqB))
    expect(authKey(reqA)).toBe(`tok:${hashRateKey(tokenA)}`)
    expect(authKey(reqA)).toBe(`tok:${createHash('sha256').update(tokenA).digest('hex').slice(0, 32)}`)
  })
})

describe('CORS origins', () => {
  it('permite el dominio de producción y rechaza otros', () => {
    expect(isAllowedOrigin('https://adeliareservas.com')).toBe(true)
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
    expect(isAllowedOrigin('https://adeliareservas.com.evil.com')).toBe(false)
  })
})

describe('timing pad', () => {
  it('no espera si ya pasó el mínimo', async () => {
    const started = Date.now() - 800
    const before = Date.now()
    await settleMinDuration(started, 50)
    expect(Date.now() - before).toBeLessThan(40)
  })
})

describe('foto de cliente', () => {
  it('acepta Cloudinary y Google, rechaza javascript', () => {
    expect(asOptionalCustomerPhotoUrl('')).toBe('')
    expect(asOptionalCustomerPhotoUrl('https://res.cloudinary.com/adelia/image/upload/v1/a.jpg'))
      .toContain('res.cloudinary.com')
    expect(asOptionalCustomerPhotoUrl('https://lh3.googleusercontent.com/a/photo'))
      .toContain('googleusercontent.com')
    expect(() => asOptionalCustomerPhotoUrl('javascript:alert(1)')).toThrow(InputError)
    expect(() => asOptionalCustomerPhotoUrl('https://evil.com/phish.png')).toThrow(InputError)
  })
})
