import { describe, expect, it } from 'vitest'
import { withQrMark } from '../helpers'
import { parseQrKind } from '../qrScan'

describe('marca de los QR impresos', () => {
  it('añade ?qr= al enlace del QR', () => {
    expect(withQrMark('https://adeliareservas.com/reservar/carol', 'reservas')).toBe('https://adeliareservas.com/reservar/carol?qr=reservas')
    expect(withQrMark('https://adeliareservas.com/reservar/carol/carta/b1?x=1', 'carta')).toBe('https://adeliareservas.com/reservar/carol/carta/b1?x=1&qr=carta')
    expect(withQrMark('', 'promo')).toBe('')
  })

  it('solo acepta los tres tipos de QR', () => {
    expect(parseQrKind('reservas')).toBe('reservas')
    expect(parseQrKind('carta')).toBe('carta')
    expect(parseQrKind('promo')).toBe('promo')
    expect(parseQrKind('otra')).toBeNull()
    expect(parseQrKind(null)).toBeNull()
  })
})
