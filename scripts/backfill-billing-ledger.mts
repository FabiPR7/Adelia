/**
 * Trae de Lemon Squeezy los cobros anteriores al libro de cobros
 * (`billingLedger`), para que el panel de administración tenga historial.
 * Los cobros nuevos ya se apuntan solos desde el webhook.
 *
 * Necesita la clave de la API de Lemon en LEMONSQUEEZY_API_KEY.
 *
 *   npx tsx scripts/backfill-billing-ledger.mts            # solo cuenta lo que haría
 *   npx tsx scripts/backfill-billing-ledger.mts --write    # escribe en la base
 */
import { recordLemonPayment } from '../server/lemonsqueezy/ledger.ts'

const write = process.argv.includes('--write')
const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim() ?? ''
if (!apiKey) {
  console.error('Falta LEMONSQUEEZY_API_KEY.')
  process.exit(1)
}

type Resource = { id: string; attributes: Record<string, unknown> }

async function listAll(path: string): Promise<Resource[]> {
  const rows: Resource[] = []
  let url: string | null = `https://api.lemonsqueezy.com/v1/${path}?page[size]=100`
  while (url) {
    const response: Response = await fetch(url, {
      headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) {
      throw new Error(`Lemon Squeezy ${path}: ${response.status}`)
    }
    const body = await response.json() as { data?: Resource[]; links?: { next?: string | null } }
    rows.push(...(body.data ?? []))
    url = body.links?.next ?? null
  }
  return rows
}

function invoiceEvent(status: unknown): string | null {
  if (status === 'paid') return 'subscription_payment_success'
  if (status === 'refunded' || status === 'partial_refund') return 'subscription_payment_refunded'
  return null
}

function orderEvent(status: unknown): string | null {
  if (status === 'paid') return 'order_created'
  if (status === 'refunded' || status === 'partial_refund') return 'order_refunded'
  return null
}

const [invoices, orders] = await Promise.all([listAll('subscription-invoices'), listAll('orders')])
const jobs = [
  ...invoices.map((row) => ({ row, event: invoiceEvent(row.attributes.status) })),
  ...orders.map((row) => ({ row, event: orderEvent(row.attributes.status) })),
].filter((job): job is { row: Resource; event: string } => job.event !== null)

console.log(`Facturas de suscripción: ${invoices.length} · pedidos: ${orders.length} · a apuntar: ${jobs.length}`)
if (!write) {
  console.log('Simulación. Con --write se escriben (las de pedido solo si son de pago único).')
  process.exit(0)
}
for (const job of jobs) {
  await recordLemonPayment(job.row, job.event)
}
console.log('Hecho.')
process.exit(0)
