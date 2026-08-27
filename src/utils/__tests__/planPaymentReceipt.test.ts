import { describe, expect, it } from 'vitest'
import {
  buildPlanPaymentReceiptHtml,
  buildPlanPaymentReceiptSubject,
  buildPlanPaymentReceiptText,
} from '../../../server/email/planPaymentConfirmation.ts'

const receipt = {
  to: 'local@example.com',
  restaurantName: 'Carolina',
  planId: 'basic' as const,
  amountCents: 3900,
  paidAt: new Date('2026-08-27T14:00:00+02:00'),
  invoiceNumber: 'ADELIA-1042',
  invoiceUrl: 'https://invoice.stripe.com/i/test',
}

describe('plan payment receipt email', () => {
  it('confirma el pago y nombra el plan', () => {
    expect(buildPlanPaymentReceiptSubject(receipt)).toContain('Sala')
    expect(buildPlanPaymentReceiptSubject(receipt)).toContain('pago confirmado')

    const html = buildPlanPaymentReceiptHtml(receipt)
    expect(html).toContain('Hemos recibido tu pago')
    expect(html).toContain('Carolina')
    expect(html).toContain('Sala')
    expect(html).toContain('Ver factura')
    expect(html).toContain('Disfruta de los beneficios')

    const text = buildPlanPaymentReceiptText(receipt)
    expect(text).toContain('39,00')
    expect(text).toContain('ADELIA-1042')
  })
})
