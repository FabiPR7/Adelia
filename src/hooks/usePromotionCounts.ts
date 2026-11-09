import { useEffect, useState } from 'react'
import { fetchPublicPromotions } from '../services/publicPromotions'
import { countPromotionsByCompany } from '../utils/mapMarkerLayout'

/** Promociones activas por restaurante, para destacar en el mapa a los que más tienen. */
export function usePromotionCounts(): Record<string, number> | undefined {
  const [counts, setCounts] = useState<Record<string, number>>()

  useEffect(() => {
    let cancelled = false

    void fetchPublicPromotions()
      .then((promotions) => {
        if (!cancelled) {
          setCounts(countPromotionsByCompany(promotions))
        }
      })
      .catch(() => {
        // Sin el recuento el mapa se ve igual, solo sin destacar promociones.
      })

    return () => {
      cancelled = true
    }
  }, [])

  return counts
}
