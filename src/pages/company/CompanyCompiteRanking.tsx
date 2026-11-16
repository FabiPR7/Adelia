import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Gift, Medal, Star, TrendingUp, Trophy, type LucideIcon } from 'lucide-react'
import { ReportHeader } from '../../components/reports/ReportKit'
import {
  fetchCompanyLeague,
  type CompanyLeagueView,
  type LeagueBoardView,
  type LeagueId,
} from '../../services/companyGamification'
import {
  getCompanyLevelForXp,
  getCompanyLevelProgress,
  getCompanyXpToNext,
} from '../../data/companyGamificationCatalog'
import styles from './CompanyCompiteRanking.module.css'

const LEAGUE_ICON: Record<LeagueId, LucideIcon> = {
  reservations: CalendarCheck,
  promotions: Gift,
  rating: Star,
  rising: TrendingUp,
}

const PRESTIGE_BY_LEVEL = (level: number) =>
  level >= 9 ? 'Diamante' : level >= 7 ? 'Oro' : level >= 4 ? 'Plata' : 'Bronce'

const PRIZES = [
  { place: '1.º', tone: 'gold', text: 'Trofeo de oro en tu ficha y primer puesto en «Lo mejor del mes» de la app.' },
  { place: '2.º', tone: 'silver', text: 'Trofeo de plata y sales en el podio de la app.' },
  { place: '3.º', tone: 'bronze', text: 'Trofeo de bronce y sales en el podio de la app.' },
  { place: 'Top 10', tone: 'plain', text: 'Más arriba en las búsquedas de tu ciudad.' },
] as const

function monthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const label = new Date(year, mon - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(year, mon - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function daysLeftInMonth(): number {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.max(0, end.getDate() - now.getDate())
}

function placeClass(rank: number): string {
  if (rank === 1) return styles.place_gold
  if (rank === 2) return styles.place_silver
  if (rank === 3) return styles.place_bronze
  return ''
}

/** Liga del mes: nivel con prestigio, tus puestos y las cuatro clasificaciones. */
function CompanyCompiteRanking() {
  const [month, setMonth] = useState<string | null>(null)
  const [scope, setScope] = useState<'city' | 'spain'>('city')
  const [leagueId, setLeagueId] = useState<LeagueId>('reservations')
  const [data, setData] = useState<CompanyLeagueView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCompanyLeague(month ?? undefined)
      .then((view) => {
        if (cancelled) return
        setData(view)
        setError(null)
        if (!view.city) setScope('spain')
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la liga. Inténtalo en un momento.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [month])

  const boards: LeagueBoardView[] = useMemo(() => {
    if (!data) return []
    return (scope === 'city' ? data.city?.boards : data.spain.boards) ?? []
  }, [data, scope])

  const board = boards.find((item) => item.id === leagueId) ?? boards[0] ?? null
  const isCurrent = data ? data.month === data.currentMonth : true
  const level = data ? getCompanyLevelForXp(data.level.xp) : null
  const toNext = data && level ? getCompanyXpToNext(data.level.xp, level) : null
  const nextLevel = level && level.maxXp != null ? getCompanyLevelForXp(level.maxXp + 1) : null
  const progress = data && level ? getCompanyLevelProgress(data.level.xp, level) : 0
  const scopeName = scope === 'city' ? data?.city?.name || 'tu ciudad' : 'España'

  const monthOptions = useMemo(() => {
    const current = data?.currentMonth
    if (!current) return []
    return Array.from({ length: 6 }, (_, index) => shiftMonth(current, -index))
  }, [data?.currentMonth])

  if (loading && !data) {
    return <p className={styles.muted}>Cargando la liga…</p>
  }

  if (error && !data) {
    return <p className={styles.error} role="alert">{error}</p>
  }

  if (!data || !level) return null

  const myBest = boards
    .filter((item) => item.me)
    .sort((a, b) => (a.me?.rank ?? 99) - (b.me?.rank ?? 99))[0]

  return (
    <div className={styles.page}>
      <ReportHeader
        title={`Liga Adelia · ${monthLabel(data.month)}`}
        subtitle={
          isCurrent
            ? `Compites con los restaurantes de ${scopeName}. Quedan ${daysLeftInMonth()} días para cerrar el mes.`
            : `Mes cerrado. Así quedaron las clasificaciones de ${scopeName}.`
        }
        actions={
          <div className={styles.headerActions}>
            {data.city ? (
              <div className={styles.segmented} role="group" aria-label="Zona">
                <button type="button" aria-pressed={scope === 'city'} className={scope === 'city' ? styles.segOn : styles.segOff} onClick={() => setScope('city')}>
                  {data.city.name || 'Mi ciudad'}
                </button>
                <button type="button" aria-pressed={scope === 'spain'} className={scope === 'spain' ? styles.segOn : styles.segOff} onClick={() => setScope('spain')}>
                  España
                </button>
              </div>
            ) : null}
            <label className={styles.monthSelect}>
              <span className={styles.srOnly}>Mes</span>
              <select value={data.month} onChange={(event) => setMonth(event.target.value)}>
                {monthOptions.map((option) => (
                  <option key={option} value={option}>
                    {monthLabel(option)}{option === data.currentMonth ? ' (en curso)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      <section className={styles.topGrid}>
        <div className={styles.levelCard}>
          <div className={styles.levelBadge}>
            <span>Nivel</span>
            <strong>{level.level}</strong>
          </div>
          <div className={styles.levelText}>
            <div className={styles.levelTitleRow}>
              <span className={styles.levelTitle}>{level.title}</span>
              <span className={`${styles.prestige} ${styles[`prestige_${data.level.prestige.id}`]}`}>
                Prestigio {data.level.prestige.label}
              </span>
            </div>
            <span className={styles.levelMeta}>
              {data.level.xp.toLocaleString('es-ES')} XP
              {toNext != null && nextLevel
                ? ` · faltan ${toNext.toLocaleString('es-ES')} para ${nextLevel.title} (${PRESTIGE_BY_LEVEL(nextLevel.level)})`
                : ' · nivel máximo'}
            </span>
            <div className={styles.levelBar} aria-hidden="true">
              <div className={styles.levelFill} style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className={styles.levelHint}>Tu nivel se ve en tu ficha pública. Más nivel, más prestigio.</span>
          </div>
        </div>

        <div className={styles.prizeCard}>
          <h2 className={styles.cardTitle}>{isCurrent ? 'Si el mes acabara hoy' : 'Tu resultado'}</h2>
          {myBest?.me && myBest.me.rank <= 3 ? (
            <div className={`${styles.prizeNow} ${placeClass(myBest.me.rank)}`}>
              <span className={styles.prizePlace}>{myBest.me.rank}.º</span>
              <span>
                <strong>Podio en «{myBest.name}» de {scopeName}</strong>: trofeo en tu ficha y sales en «Lo mejor del mes» de la app.
              </span>
            </div>
          ) : myBest?.me ? (
            <p className={styles.prizeText}>
              Vas <strong>{myBest.me.rank}.º</strong> en «{myBest.name}». Entra en el podio para ganar trofeo y salir en la app.
            </p>
          ) : (
            <p className={styles.prizeText}>Aún no apareces en ninguna liga este mes. Marca la asistencia de tus reservas y entrega premios con PIN para empezar a puntuar.</p>
          )}
          {myBest?.ahead ? (
            <span className={styles.gap}>
              A {myBest.ahead.gap.toLocaleString('es-ES')} de {myBest.ahead.name} ({myBest.ahead.rank}.º)
            </span>
          ) : null}
        </div>
      </section>

      <section className={styles.positions} aria-label="Tus puestos">
        {boards.map((item) => {
          const Icon = LEAGUE_ICON[item.id]
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.position} ${item.id === board?.id ? styles.positionOn : ''}`}
              aria-pressed={item.id === board?.id}
              onClick={() => setLeagueId(item.id)}
            >
              <span className={styles.positionName}><Icon size={15} aria-hidden="true" />{item.name}</span>
              <span className={styles.positionRank}>
                {item.me ? `${item.me.rank}.º` : '—'}
                <span className={styles.positionOf}>{item.total > 0 ? ` de ${item.total}` : ''}</span>
              </span>
              <span className={styles.positionMeta}>
                {item.me ? `${item.me.display} ${item.id === 'rating' || item.id === 'rising' ? '' : item.unit}` : 'Sin puntuar aún'}
              </span>
            </button>
          )
        })}
      </section>

      {board ? (
        <section className={styles.boardGrid}>
          <div className={styles.boardMain}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>{board.name}</h2>
                  <span className={styles.cardMeta}>{board.rule}</span>
                </div>
                <span className={styles.cardMeta}>{board.total} {board.total === 1 ? 'restaurante' : 'restaurantes'}</span>
              </div>
              {board.top.length === 0 ? (
                <p className={styles.empty}>Todavía nadie puntúa en esta liga este mes. ¡El primero en moverse se lleva el podio!</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Puesto</th>
                        <th scope="col">Restaurante</th>
                        <th scope="col">Nivel</th>
                        <th scope="col" className={styles.right}>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.top.map((row) => (
                        <tr key={row.companyId} className={row.isMe ? styles.rowMe : ''}>
                          <td><span className={`${styles.place} ${placeClass(row.rank)}`}>{row.rank}</span></td>
                          <td>
                            <div className={styles.restaurant}>
                              <span className={styles.restaurantName}>{row.name}{row.isMe ? ' (tú)' : ''}</span>
                              <span className={styles.restaurantMeta}>{row.municipality}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.levelChip} ${styles[`prestige_${row.level >= 9 ? 'diamond' : row.level >= 7 ? 'gold' : row.level >= 4 ? 'silver' : 'bronze'}`]}`}>
                              Nv. {row.level}
                            </span>
                          </td>
                          <td className={`${styles.right} ${styles.result}`}>{row.display}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {board.me && board.me.rank > 10 ? (
                <p className={styles.meOutside}>Tú vas <strong>{board.me.rank}.º</strong> con {board.me.display}.</p>
              ) : null}
            </div>
          </div>

          <aside className={styles.side}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}><Trophy size={15} aria-hidden="true" /> Premios de cada liga</h2>
              <ul className={styles.prizeList}>
                {PRIZES.map((prize) => (
                  <li key={prize.place}>
                    <span className={`${styles.prizeBadge} ${styles[`badge_${prize.tone}`]}`}>{prize.place}</span>
                    <span>{prize.text}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.small}>Los trofeos se guardan al cerrar el mes y se ven en tu ficha.</p>
            </div>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}><Medal size={15} aria-hidden="true" /> Tus trofeos</h2>
              {data.trophies.length === 0 ? (
                <p className={styles.small}>Aún no tienes trofeos. El 1 de cada mes se reparten los del mes anterior.</p>
              ) : (
                <div className={styles.trophies}>
                  {data.trophies.map((trophy) => (
                    <span key={`${trophy.month}-${trophy.league}-${trophy.scope}`} className={`${styles.trophy} ${placeClass(trophy.rank)}`}>
                      {trophy.rank}.º {boards.find((item) => item.id === trophy.league)?.name ?? trophy.league}
                      {trophy.scope === 'spain' ? ' · España' : ''} · {monthLabel(trophy.month).split(' ')[0]}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Juego limpio</h2>
              <p className={styles.small}>
                Cuentan las reservas que marcas como «Asistió». De un mismo cliente cuentan como mucho 4 al mes, y en
                empate gana quien tenga menos faltas.
              </p>
            </div>
          </aside>
        </section>
      ) : null}
    </div>
  )
}

export default CompanyCompiteRanking
