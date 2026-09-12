import { useCallback, useEffect, useMemo, useState } from 'react'
import InfoHint from '../../components/company/InfoHint'
import { getFirestoreErrorMessage } from '../../services/firestore'
import { getCompanyMenuBoards } from '../../services/companyMenu'
import { getCompanyPromotions } from '../../services/promotions'
import {
  fetchCompanyMonthMetrics,
  monthKeysInRange,
  type CompanyMonthMetrics,
} from '../../services/companyMetrics'
import { downloadExcelFile } from '../../utils/exportSpreadsheet'
import styles from './CompanyReportsApp.module.css'

interface CompanyReportsAppProps {
  companyId: string
}

type RangeId = 'this-month' | 'last-month' | 'last-3-months'

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'this-month', label: 'Este mes' },
  { id: 'last-month', label: 'Mes pasado' },
  { id: 'last-3-months', label: 'Últimos 3 meses' },
]

interface RangeWindow {
  months: string[]
  prevMonths: string[]
  label: string
}

function rangeWindow(id: RangeId): RangeWindow {
  const now = new Date()
  const monthStart = (offset: number) => new Date(now.getFullYear(), now.getMonth() + offset, 1)

  if (id === 'this-month') {
    return {
      months: monthKeysInRange(monthStart(0), monthStart(0)),
      prevMonths: monthKeysInRange(monthStart(-1), monthStart(-1)),
      label: new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now),
    }
  }
  if (id === 'last-month') {
    return {
      months: monthKeysInRange(monthStart(-1), monthStart(-1)),
      prevMonths: monthKeysInRange(monthStart(-2), monthStart(-2)),
      label: new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(monthStart(-1)),
    }
  }
  return {
    months: monthKeysInRange(monthStart(-2), monthStart(0)),
    prevMonths: monthKeysInRange(monthStart(-5), monthStart(-3)),
    label: 'últimos 3 meses',
  }
}

interface Aggregate {
  profileViews: number
  menuViews: number
  promoZoneViews: number
  promoViews: number
  promoClaims: number
  promoReserveClicks: number
  reservationsFromPromo: number
  reservationsFromProfile: number
  searchImpressions: number
  searchClicks: number
  favoritesAdd: number
  favoritesRemove: number
  uniques: number
  daily: { day: string; views: number; promoViews: number }[]
  menuBoards: Record<string, number>
  promos: Record<string, { views: number; claims: number; reserveClicks: number; reservations: number }>
}

function aggregate(months: CompanyMonthMetrics[]): Aggregate {
  const out: Aggregate = {
    profileViews: 0,
    menuViews: 0,
    promoZoneViews: 0,
    promoViews: 0,
    promoClaims: 0,
    promoReserveClicks: 0,
    reservationsFromPromo: 0,
    reservationsFromProfile: 0,
    searchImpressions: 0,
    searchClicks: 0,
    favoritesAdd: 0,
    favoritesRemove: 0,
    uniques: 0,
    daily: [],
    menuBoards: {},
    promos: {},
  }

  for (const month of months) {
    out.profileViews += month.views.profile
    out.menuViews += month.views.menuZone + month.views.menuBoardOpens
    out.promoZoneViews += month.views.promoZone
    out.promoViews += month.promo.views
    out.promoClaims += month.promo.claims
    out.promoReserveClicks += month.promo.reserveClicks
    out.reservationsFromPromo += month.reservations.fromPromo
    out.reservationsFromProfile += month.reservations.fromProfile
    out.searchImpressions += month.search.impressions
    out.searchClicks += month.search.clicks
    out.favoritesAdd += month.favorites.add
    out.favoritesRemove += month.favorites.remove
    for (const value of Object.values(month.uniquesByDay)) {
      out.uniques += value
    }
    for (const [day, entry] of Object.entries(month.daily)) {
      out.daily.push({ day, views: entry.views, promoViews: entry.promoViews })
    }
    for (const [id, count] of Object.entries(month.menuBoards)) {
      out.menuBoards[id] = (out.menuBoards[id] ?? 0) + count
    }
    for (const [id, entry] of Object.entries(month.promos)) {
      const current = out.promos[id] ?? { views: 0, claims: 0, reserveClicks: 0, reservations: 0 }
      out.promos[id] = {
        views: current.views + entry.views,
        claims: current.claims + entry.claims,
        reserveClicks: current.reserveClicks + entry.reserveClicks,
        reservations: current.reservations + entry.reservations,
      }
    }
  }

  out.daily.sort((a, b) => a.day.localeCompare(b.day))
  return out
}

function delta(current: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (previous <= 0) {
    return current > 0 ? { text: 'nuevo', tone: 'up' } : { text: '—', tone: 'flat' }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) {
    return { text: '=', tone: 'flat' }
  }
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, tone: pct > 0 ? 'up' : 'down' }
}

function CompanyReportsApp({ companyId }: CompanyReportsAppProps) {
  const [rangeId, setRangeId] = useState<RangeId>('this-month')
  const [months, setMonths] = useState<CompanyMonthMetrics[]>([])
  const [prevMonths, setPrevMonths] = useState<CompanyMonthMetrics[]>([])
  const [boardNames, setBoardNames] = useState<Record<string, string>>({})
  const [promoNames, setPromoNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const window = useMemo(() => rangeWindow(rangeId), [rangeId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [current, previous, boards, promotions] = await Promise.all([
        fetchCompanyMonthMetrics(companyId, window.months),
        fetchCompanyMonthMetrics(companyId, window.prevMonths),
        getCompanyMenuBoards(companyId).catch(() => []),
        getCompanyPromotions(companyId).catch(() => []),
      ])
      setMonths(current)
      setPrevMonths(previous)
      setBoardNames(Object.fromEntries(boards.map((board) => [board.id, board.name])))
      setPromoNames(Object.fromEntries(promotions.map((promotion) => [promotion.id, promotion.title])))
    } catch (caught) {
      setError(getFirestoreErrorMessage(caught, 'load'))
    } finally {
      setLoading(false)
    }
  }, [companyId, window.months, window.prevMonths])

  useEffect(() => {
    void load()
  }, [load])

  const now = useMemo(() => aggregate(months), [months])
  const before = useMemo(() => aggregate(prevMonths), [prevMonths])

  const tiles = [
    { key: 'profile', label: 'Visitas al perfil', value: now.profileViews, prev: before.profileViews },
    { key: 'menu', label: 'Aperturas de carta', value: now.menuViews, prev: before.menuViews },
    { key: 'promoZone', label: 'Visitas a promos', value: now.promoZoneViews, prev: before.promoZoneViews },
    { key: 'claims', label: 'Promos reclamadas', value: now.promoClaims, prev: before.promoClaims },
    { key: 'reserveClicks', label: 'Clics a "Reservar" desde promo', value: now.promoReserveClicks, prev: before.promoReserveClicks },
    { key: 'uniques', label: 'Personas distintas', value: now.uniques, prev: before.uniques },
  ]

  const topBoards = useMemo(
    () =>
      Object.entries(now.menuBoards)
        .map(([id, count]) => ({ id, name: boardNames[id] ?? 'Carta borrada', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    [now.menuBoards, boardNames],
  )

  const topPromos = useMemo(
    () =>
      Object.entries(now.promos)
        .map(([id, entry]) => ({ id, name: promoNames[id] ?? 'Promo borrada', ...entry }))
        .sort((a, b) => b.views + b.reserveClicks - (a.views + a.reserveClicks))
        .slice(0, 10),
    [now.promos, promoNames],
  )

  const maxDaily = Math.max(1, ...now.daily.map((point) => point.views))
  const funnelRate = now.promoReserveClicks > 0
    ? Math.round((now.reservationsFromPromo / now.promoReserveClicks) * 100)
    : 0

  const exportExcel = () => {
    const rows: (string | number)[][] = [
      ['— Resumen —', '', '', '', ''],
      ['Métrica', 'Periodo actual', 'Periodo anterior', '', ''],
      ...tiles.map((tile) => [tile.label, tile.value, tile.prev, '', '']),
      ['Reservas desde promo', now.reservationsFromPromo, before.reservationsFromPromo, '', ''],
      ['Reservas desde perfil', now.reservationsFromProfile, before.reservationsFromProfile, '', ''],
      ['Impresiones en búsqueda', now.searchImpressions, before.searchImpressions, '', ''],
      ['Clics en búsqueda', now.searchClicks, before.searchClicks, '', ''],
      ['Favoritos añadidos', now.favoritesAdd, before.favoritesAdd, '', ''],
      ['Favoritos quitados', now.favoritesRemove, before.favoritesRemove, '', ''],
      ['', '', '', '', ''],
      ['— Cartas más vistas —', '', '', '', ''],
      ['Carta', 'Aperturas', '', '', ''],
      ...topBoards.map((board) => [board.name, board.count, '', '', '']),
      ['', '', '', '', ''],
      ['— Promos con más tirón —', '', '', '', ''],
      ['Promo', 'Vistas', 'Reclamos', 'Clics reservar', 'Reservas'],
      ...topPromos.map((promo) => [promo.name, promo.views, promo.claims, promo.reserveClicks, promo.reservations]),
    ]
    downloadExcelFile(`informe-app-${rangeId}`, [], rows)
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>
          Informe de la App
          <InfoHint label="Sobre el informe de la App">
            Cómo se comporta la gente con tu restaurante dentro de Adelia: cuánta ve tu ficha, abre
            tus cartas, entra en tus promos, qué promos clica y cuántas reservas nacen de una promo.
            Son totales — nunca ves quién es cada persona. "Personas distintas" se calcula una vez al
            día, puede tardar en aparecer.
          </InfoHint>
        </h2>
        <div className={styles.controls}>
          <div className={styles.rangeTabs} role="group" aria-label="Periodo">
            {RANGES.map((range) => (
              <button
                key={range.id}
                type="button"
                className={rangeId === range.id ? styles.rangeTabOn : styles.rangeTab}
                aria-pressed={rangeId === range.id}
                onClick={() => setRangeId(range.id)}
              >
                {range.label}
              </button>
            ))}
          </div>
          <button type="button" className={styles.exportBtn} onClick={exportExcel} disabled={loading}>
            Exportar Excel
          </button>
        </div>
        <p className={styles.periodLabel}>Datos de {window.label}</p>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {loading ? (
        <p className={styles.loading}>Cargando…</p>
      ) : (
        <>
          <section className={styles.kpiGrid} aria-label="Resumen">
            {tiles.map((tile) => {
              const change = delta(tile.value, tile.prev)
              return (
                <div key={tile.key} className={styles.kpi}>
                  <span className={styles.kpiLabel}>{tile.label}</span>
                  <strong className={styles.kpiValue}>{tile.value.toLocaleString('es-ES')}</strong>
                  <span className={`${styles.kpiDelta} ${styles[`delta_${change.tone}`]}`}>
                    {change.text} vs. periodo anterior
                  </span>
                </div>
              )
            })}
          </section>

          <section className={styles.panel} aria-label="Visitas por día">
            <h3>Visitas por día</h3>
            {now.daily.length === 0 ? (
              <p className={styles.empty}>Sin datos todavía.</p>
            ) : (
              <div className={styles.bars}>
                {now.daily.map((point) => (
                  <div key={point.day} className={styles.barCol} title={`${point.day}: ${point.views} visitas`}>
                    <span
                      className={styles.bar}
                      style={{ height: `${Math.max(3, (point.views / maxDaily) * 100)}%` }}
                    />
                    <span className={styles.barLabel}>{point.day.slice(8)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel} aria-label="Embudo de promociones">
            <h3>De promo a reserva</h3>
            <div className={styles.funnel}>
              <div className={styles.funnelStep}>
                <strong>{now.promoViews.toLocaleString('es-ES')}</strong>
                <span>Promos vistas</span>
              </div>
              <span className={styles.funnelArrow} aria-hidden="true">→</span>
              <div className={styles.funnelStep}>
                <strong>{now.promoReserveClicks.toLocaleString('es-ES')}</strong>
                <span>Clics a reservar</span>
              </div>
              <span className={styles.funnelArrow} aria-hidden="true">→</span>
              <div className={styles.funnelStep}>
                <strong>{now.reservationsFromPromo.toLocaleString('es-ES')}</strong>
                <span>Reservas hechas</span>
              </div>
              <div className={styles.funnelRate}>{funnelRate}% de los clics acaban en reserva</div>
            </div>
          </section>

          <section className={styles.panel} aria-label="Cartas más vistas">
            <h3>Cartas más vistas</h3>
            {topBoards.length === 0 ? (
              <p className={styles.empty}>Nadie ha abierto una carta concreta todavía.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr><th>Carta</th><th>Aperturas</th></tr>
                </thead>
                <tbody>
                  {topBoards.map((board) => (
                    <tr key={board.id}>
                      <td>{board.name}</td>
                      <td className={styles.num}>{board.count.toLocaleString('es-ES')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={styles.panel} aria-label="Promos con más tirón">
            <h3>Promos con más tirón</h3>
            {topPromos.length === 0 ? (
              <p className={styles.empty}>Sin datos de promos todavía.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Promo</th><th>Vistas</th><th>Reclamos</th><th>Clics reservar</th><th>Reservas</th>
                  </tr>
                </thead>
                <tbody>
                  {topPromos.map((promo) => (
                    <tr key={promo.id}>
                      <td>{promo.name}</td>
                      <td className={styles.num}>{promo.views.toLocaleString('es-ES')}</td>
                      <td className={styles.num}>{promo.claims.toLocaleString('es-ES')}</td>
                      <td className={styles.num}>{promo.reserveClicks.toLocaleString('es-ES')}</td>
                      <td className={styles.num}>{promo.reservations.toLocaleString('es-ES')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default CompanyReportsApp
