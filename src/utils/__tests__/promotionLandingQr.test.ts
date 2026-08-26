import { describe, expect, it } from 'vitest'
import { buildPromotionLandingPath } from '../promotionBooking'
import { parseCompanyQrBranding } from '../qrBranding'

describe('promotion landing QR', () => {
  it('arma la ruta pública de la promo', () => {
    expect(buildPromotionLandingPath('casa-luna', 'promo-1')).toBe(
      '/reservar/casa-luna/promo/promo-1',
    )
  })

  it('rellena branding de promoción si el local no lo tenía', () => {
    const branding = parseCompanyQrBranding({ booking: {}, menu: {} })
    expect(branding.promotion.showTitle).toBe(true)
    expect(branding.promotion.logoMode).toBe('adelia')
  })
})
