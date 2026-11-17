import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { useCompanyGamification } from '../../../hooks/useCompanyGamification'
import { useCompanyNotifications } from '../../../hooks/useCompanyNotifications'
import { fetchCompanyLeague, type CompanyLeagueView, type LeagueId } from '../../../services/companyGamification'
import type { CompanyTab } from '../../../types/company'
import ArenaHome from './ArenaHome'
import { ArenaChallenges, ArenaShowcase, ArenaStandings } from './ArenaViews'
import { monthName, type ArenaView } from './arenaUtils'
import styles from './Arena.module.css'

const VIEWS: Array<{ id: ArenaView; label: string }> = [
  { id: 'arena', label: 'Arena' },
  { id: 'standings', label: 'Clasificaciones' },
  { id: 'challenges', label: 'Retos' },
  { id: 'showcase', label: 'Vitrina' },
]

interface CompiteArenaProps {
  initialView?: ArenaView
  onOpenTab: (tab: CompanyTab) => void
}

/** Compite: la Liga Adelia vista como una arena, aparte del resto del panel. */
export default function CompiteArena({ initialView = 'arena', onOpenTab }: CompiteArenaProps) {
  const [view, setView] = useState<ArenaView>(initialView)
  const [league, setLeague] = useState<LeagueId | null>(null)
  const [data, setData] = useState<CompanyLeagueView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gamification = useCompanyGamification(true)
  const { notifications } = useCompanyNotifications()

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  useEffect(() => {
    let cancelled = false
    fetchCompanyLeague()
      .then((view) => {
        if (!cancelled) setData(view)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la liga. Inténtalo en un momento.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openView = (next: ArenaView, nextLeague?: LeagueId) => {
    if (nextLeague) setLeague(nextLeague)
    setView(next)
  }

  const cityName = data?.city?.name || 'España'

  return (
    <div className={styles.arena}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}><Trophy size={24} aria-hidden="true" /></span>
            <div>
              <span className={styles.brandKicker}>Liga Adelia · {cityName}</span>
              <h1 className={styles.brandTitle}>
                Temporada de {data ? monthName(data.currentMonth) : '…'}
              </h1>
            </div>
          </div>
          <nav className={styles.nav} aria-label="Secciones de Compite">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? 'page' : undefined}
                className={view === item.id ? styles.navBtnOn : styles.navBtn}
                onClick={() => openView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        {view === 'challenges' ? (
          gamification.loading ? (
            <p className={styles.loading}>Cargando retos…</p>
          ) : (
            <ArenaChallenges gamification={gamification} />
          )
        ) : !data ? (
          <p className={error ? styles.error : styles.loading} role={error ? 'alert' : undefined}>
            {error ?? 'Preparando la arena…'}
          </p>
        ) : view === 'arena' ? (
          <ArenaHome
            data={data}
            gamification={gamification}
            notifications={notifications}
            onView={openView}
            onOpenTab={onOpenTab}
          />
        ) : view === 'standings' ? (
          <ArenaStandings key={league ?? 'all'} initial={data} league={league} />
        ) : (
          <ArenaShowcase data={data} />
        )}
      </div>
    </div>
  )
}
