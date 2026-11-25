import { useEffect, useState } from 'react'
import { isDemoCompanyId } from '../data/companyPanelDemo'
import { fetchCompanyMonthMetrics } from '../services/companyMetrics'

export interface QrScanCounts {
  reservas: number
  carta: number
  promo: number
  byPromo: Record<string, number>
  byBoard: Record<string, number>
}

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Escaneos de los QR del local este mes, para enseñarlos junto a cada QR. */
export function useQrScanCounts(companyId: string | null | undefined): QrScanCounts | null {
  const [counts, setCounts] = useState<QrScanCounts | null>(null)

  useEffect(() => {
    if (!companyId || isDemoCompanyId(companyId)) {
      setCounts(null)
      return
    }
    let cancelled = false
    void fetchCompanyMonthMetrics(companyId, [currentMonthKey()])
      .then(([month]) => {
        if (cancelled) return
        const byPromo: Record<string, number> = {}
        for (const [id, entry] of Object.entries(month?.promos ?? {})) {
          if (entry.qrScans > 0) byPromo[id] = entry.qrScans
        }
        setCounts({
          reservas: month?.qr.reservas ?? 0,
          carta: month?.qr.carta ?? 0,
          promo: month?.qr.promo ?? 0,
          byPromo,
          byBoard: month?.qrMenuBoards ?? {},
        })
      })
      .catch(() => {
        // Sin datos: no se enseña el contador.
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  return counts
}

