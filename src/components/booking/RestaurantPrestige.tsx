import { useEffect, useState } from 'react'
import styles from './RestaurantPrestige.module.css'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

interface PrestigeData {
  level: number
  levelTitle: string
  prestige: { id: 'bronze' | 'silver' | 'gold' | 'diamond'; label: string }
  trophies: Array<{ month: string; league: 'reservations' | 'promotions' | 'rating' | 'rising'; rank: number }>
  badges: Array<{ id: string; name: string; tier: 'bronze' | 'silver' | 'gold' }>
}

const LEAGUE_NAME: Record<string, string> = {
  reservations: 'en reservas',
  promotions: 'en premios',
  rating: 'mejor valorado',
  rising: 'revelación',
}

const TIER_LABEL = { bronze: 'bronce', silver: 'plata', gold: 'oro' } as const

function monthShort(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return new Date(year, mon - 1, 1).toLocaleDateString('es-ES', { month: 'long' })
}

/** Nivel, trofeos de la Liga Adelia e insignias del local: dan confianza al reservar. */
function RestaurantPrestige({ slug }: { slug: string }) {
  const [data, setData] = useState<PrestigeData | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    fetch(`${API_BASE}/api/public/discovery/prestige/${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json: PrestigeData | null) => {
        if (!cancelled) setData(json)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [slug])

  if (!data) return null
  const trophies = data.trophies
    .filter((trophy) => trophy.rank >= 1 && trophy.rank <= 3)
    .slice(0, 3)
  const badges = [...data.badges]
    .sort((a, b) => ['gold', 'silver', 'bronze'].indexOf(a.tier) - ['gold', 'silver', 'bronze'].indexOf(b.tier))
    .slice(0, 3)

  return (
    <section className={styles.strip} aria-label="Prestigio del restaurante">
      <span className={`${styles.level} ${styles[`tone_${data.prestige.id}`]}`} title={data.levelTitle}>
        Nivel {data.level} · {data.prestige.label}
      </span>
      {trophies.map((trophy) => (
        <span key={`${trophy.month}-${trophy.league}`} className={`${styles.trophy} ${styles[`rank_${trophy.rank}`]}`}>
          🏆 {trophy.rank}.º {LEAGUE_NAME[trophy.league] ?? ''} · {monthShort(trophy.month)}
        </span>
      ))}
      {badges.map((badge) => (
        <span key={badge.id} className={`${styles.badge} ${styles[`tone_${badge.tier}`]}`}>
          {badge.name} · {TIER_LABEL[badge.tier]}
        </span>
      ))}
    </section>
  )
}

export default RestaurantPrestige
