import type { Company } from '../types'

export interface CompanyHealthItem {
  id: string
  label: string
  ok: boolean
}

export function companyProfileHealth(
  company: Company,
  extra?: { menuBoards?: number },
): CompanyHealthItem[] {
  const photos = company.photos?.length ?? 0
  const hasAddress = Boolean(company.municipality || company.postalCode)
  const stripeReady = company.stripeChargesEnabled || company.stripeDetailsSubmitted

  return [
    { id: 'photos', label: photos > 0 ? `${photos} foto${photos === 1 ? '' : 's'}` : 'Sin fotos', ok: photos > 0 },
    { id: 'logo', label: company.logoUrl ? 'Logo listo' : 'Sin logo', ok: Boolean(company.logoUrl) },
    { id: 'description', label: company.description ? 'Texto de ficha' : 'Ficha sin texto', ok: Boolean(company.description?.trim()) },
    { id: 'address', label: hasAddress ? 'Ubicación completa' : 'Falta pueblo o CP', ok: hasAddress },
    { id: 'stripe', label: stripeReady ? 'Stripe conectado' : 'Stripe pendiente', ok: stripeReady },
    {
      id: 'reviews',
      label: company.reviewCount > 0 ? `${company.reviewCount} reseñas` : 'Sin reseñas',
      ok: company.reviewCount > 0,
    },
    {
      id: 'menu',
      label:
        extra?.menuBoards == null
          ? 'Carta'
          : extra.menuBoards > 0
            ? `${extra.menuBoards} carta${extra.menuBoards === 1 ? '' : 's'} publicada`
            : 'Sin carta publicada',
      ok: (extra?.menuBoards ?? 0) > 0,
    },
  ]
}

export function companyHealthScore(items: CompanyHealthItem[]): number {
  if (items.length === 0) {
    return 0
  }

  return Math.round((items.filter((item) => item.ok).length / items.length) * 100)
}
