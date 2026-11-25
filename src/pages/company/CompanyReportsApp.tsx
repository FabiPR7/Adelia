import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarRange,
  Download,
  Eye,
  Filter,
  Heart,
  MousePointerClick,
  RefreshCw,
  Search,
  Tag,
  TicketCheck,
  UserRound,
} from 'lucide-react'
import {
  computeDelta,
  EmptyState,
  formatNumber,
  InlineBar,
  KpiCard,
  KpiGrid,
  LoadingState,
  ReportCard,
  ReportHeader,
  reportStyles as styles,
  TableCard,
} from '../../components/reports/ReportKit'
import { getFirestoreErrorMessage } from '../../services/firestore'
import { getCompanyMenuBoards } from '../../services/companyMenu'
import { getCompanyPromotions } from '../../services/promotions'
import {
  fetchCompanyMonthMetrics,
  monthKeysInRange,
  type CompanyMonthMetrics,
} from '../../services/companyMetrics'
import { downloadExcelFile } from '../../utils/exportSpreadsheet'
import QrScansPanel from '../../components/reports/QrScansPanel'

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
  daily: { day: string; views: number; promoViews: number; qrScans: number }[]
  menuBoards: Record<string, number>
  qrMenuBoards: Record<string, number>
  promos: Record<string, { views: number; claims: number; reserveClicks: number; reservations: number; qrScans: number }>
  qr: { total: number; reservas: number; carta: number; promo: number }
  reservationsFromQr: number
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
    qrMenuBoards: {},
    promos: {},
    qr: { total: 0, reservas: 0, carta: 0, promo: 0 },
    reservationsFromQr: 0,
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
    out.reservationsFromQr += month.reservations.fromQr
    out.qr.total += month.qr.total
    out.qr.reservas += month.qr.reservas
    out.qr.carta += month.qr.carta
    out.qr.promo += month.qr.promo
    for (const [id, count] of Object.entries(month.qrMenuBoards)) {
      out.qrMenuBoards[id] = (out.qrMenuBoards[id] ?? 0) + count
    }
    out.searchImpressions += month.search.impressions
    out.searchClicks += month.search.clicks
    out.favoritesAdd += month.favorites.add
    out.favoritesRemove += month.favorites.remove
    for (const value of Object.values(month.uniquesByDay)) {
      out.uniques += value
    }
    for (const [day, entry] of Object.entries(month.daily)) {
      out.daily.push({ day, views: entry.views, promoViews: entry.promoViews, qrScans: entry.qrScans })
    }
    for (const [id, count] of Object.entries(month.menuBoards)) {
      out.menuBoards[id] = (out.menuBoards[id] ?? 0) + count
    }
    for (const [id, entry] of Object.entries(month.promos)) {
      const current = out.promos[id] ?? { views: 0, claims: 0, reserveClicks: 0, reservations: 0, qrScans: 0 }
      out.promos[id] = {
        views: current.views + entry.views,
        claims: current.claims + entry.claims,
        reserveClicks: current.reserveClicks + entry.reserveClicks,
        reservations: current.reservations + entry.reservations,
        qrScans: current.qrScans + entry.qrScans,
      }
    }
  }

  out.daily.sort((a, b) => a.day.localeCompare(b.day))
  return out
}

/** Escaneos de QR de cada día del periodo (hasta hoy), con 0 en los días sin ninguno. */
function qrScansByDay(months: string[], daily: Aggregate['daily']): { day: string; qrScans: number }[] {
  if (months.length === 0) return []
  const byDay = new Map(daily.map((point) => [point.day, point.qrScans]))
  const today = new Date().toISOString().slice(0, 10)
  const [firstYear, firstMonth] = months[0].split('-').map(Number)
  const [lastYear, lastMonth] = months[months.length - 1].split('-').map(Number)
  const cursor = new Date(Date.UTC(firstYear, firstMonth - 1, 1))
  const end = new Date(Date.UTC(lastYear, lastMonth, 0))
  const out: { day: string; qrScans: number }[] = []
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10)
    if (day > today) break
    out.push({ day, qrScans: byDay.get(day) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function CompanyReportsApp({ companyId }: CompanyReportsAppProps) {
  const [rangeId, setRangeId] = useState<RangeId>('this-month')
  const [months, setMonths] = useState<CompanyMonthMetrics[]>([])
  const [prevMonths, setPrevMonths] = useState<CompanyMonthMetrics[]>([])
  const [boardNames, setBoardNames] = useState<Record<string, string>>({})
  const [promoNames, setPromoNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => rangeWindow(rangeId), [rangeId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [current, previous, boards, promotions] = await Promise.all([
        fetchCompanyMonthMetrics(companyId, range.months),
        fetchCompanyMonthMetrics(companyId, range.prevMonths),
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
  }, [companyId, range.months, range.prevMonths])

  useEffect(() => {
    void load()
  }, [load])

  const now = useMemo(() => aggregate(months), [months])
  const before = useMemo(() => aggregate(prevMonths), [prevMonths])

  const tiles = [
    { key: 'profile', icon: Eye, label: 'Visitas a tu ficha', value: now.profileViews, prev: before.profileViews, tone: 'info' as const },
    { key: 'uniques', icon: UserRound, label: 'Personas distintas', value: now.uniques, prev: before.uniques, tone: 'default' as const },
    { key: 'menu', icon: BookOpen, label: 'Aperturas de carta', value: now.menuViews, prev: before.menuViews, tone: 'default' as const },
    { key: 'promoZone', icon: Tag, label: 'Visitas a promociones', value: now.promoZoneViews, prev: before.promoZoneViews, tone: 'warn' as const },
    { key: 'claims', icon: TicketCheck, label: 'Promos reclamadas', value: now.promoClaims, prev: before.promoClaims, tone: 'good' as const },
    { key: 'reserveClicks', icon: MousePointerClick, label: 'Clics en «Reservar» desde promo', value: now.promoReserveClicks, prev: before.promoReserveClicks, tone: 'good' as const },
  ]

  const topBoards = useMemo(
    () =>
      [...new Set([...Object.keys(now.menuBoards), ...Object.keys(now.qrMenuBoards)])]
        .map((id) => ({
          id,
          name: boardNames[id] ?? 'Carta borrada',
          count: now.menuBoards[id] ?? 0,
          qrScans: now.qrMenuBoards[id] ?? 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    [now.menuBoards, now.qrMenuBoards, boardNames],
  )

  const topPromos = useMemo(
    () =>
      Object.entries(now.promos)
        .map(([id, entry]) => ({ id, name: promoNames[id] ?? 'Promo borrada', ...entry }))
        .sort((a, b) => b.views + b.reserveClicks - (a.views + a.reserveClicks))
        .slice(0, 10),
    [now.promos, promoNames],
  )

  // Para «Tus códigos QR»: todas las cartas y promos, las más escaneadas primero.
  const qrBoards = useMemo(
    () =>
      Object.entries(boardNames)
        .map(([id, name]) => ({ id, name, qrScans: now.qrMenuBoards[id] ?? 0 }))
        .sort((a, b) => b.qrScans - a.qrScans),
    [boardNames, now.qrMenuBoards],
  )
  const qrPromos = useMemo(
    () =>
      Object.entries(promoNames)
        .map(([id, name]) => ({ id, name, qrScans: now.promos[id]?.qrScans ?? 0 }))
        .sort((a, b) => b.qrScans - a.qrScans),
    [promoNames, now.promos],
  )

  // «Este mes» va por la mitad: se compara con los mismos días del mes anterior.
  const qrPreviousTotal = useMemo(() => {
    if (rangeId !== 'this-month') return before.qr.total
    const todayDay = new Date().getDate()
    return before.daily
      .filter((point) => Number(point.day.slice(8)) <= todayDay)
      .reduce((sum, point) => sum + point.qrScans, 0)
  }, [rangeId, before])

  const maxDaily = Math.max(1, ...now.daily.map((point) => point.views))
  const totalDaily = now.daily.reduce((sum, point) => sum + point.views, 0)
  const bestDay = now.daily.reduce<{ day: string; views: number } | null>(
    (best, point) => (!best || point.views > best.views ? point : best),
    null,
  )
  const maxBoard = Math.max(1, ...topBoards.map((board) => board.count))
  const searchCtr = percent(now.searchClicks, now.searchImpressions)
  const favoritesNet = now.favoritesAdd - now.favoritesRemove

  const funnelSteps = [
    { label: 'Promos vistas', value: now.promoViews },
    { label: 'Clics en «Reservar»', value: now.promoReserveClicks },
    { label: 'Reservas hechas', value: now.reservationsFromPromo },
  ]
  const funnelMax = Math.max(1, ...funnelSteps.map((step) => step.value))

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
      ['Escaneos de QR (total)', now.qr.total, before.qr.total, '', ''],
      ['Escaneos del QR de reservas', now.qr.reservas, before.qr.reservas, '', ''],
      ['Escaneos de QR de cartas', now.qr.carta, before.qr.carta, '', ''],
      ['Escaneos de QR de promociones', now.qr.promo, before.qr.promo, '', ''],
      ['Reservas tras escanear un QR', now.reservationsFromQr, before.reservationsFromQr, '', ''],
      ['', '', '', '', ''],
      ['— Cartas más vistas —', '', '', '', ''],
      ['Carta', 'Aperturas', 'Por QR', '', ''],
      ...topBoards.map((board) => [board.name, board.count, board.qrScans, '', '']),
      ['', '', '', '', ''],
      ['— Promos con más tirón —', '', '', '', ''],
      ['Promo', 'Vistas', 'Reclamos', 'Clics reservar', 'Reservas', 'Escaneos QR'],
      ...topPromos.map((promo) => [promo.name, promo.views, promo.claims, promo.reserveClicks, promo.reservations, promo.qrScans]),
    ]
    downloadExcelFile(`informe-app-${rangeId}`, [], rows)
  }

  return (
    <div className={styles.page}>
      <ReportHeader
        title="Informe de la app"
        subtitle="Cómo se mueve la gente con tu local dentro de Adelia. Son totales: nunca ves quién es cada persona."
        actions={(
          <button type="button" className={styles.secondaryButton} onClick={exportExcel} disabled={loading}>
            <Download size={15} aria-hidden="true" />
            Excel
          </button>
        )}
      />

      <div className={styles.periodBar}>
        <div className={styles.segmented} role="radiogroup" aria-label="Periodo">
          {RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={rangeId === option.id}
              className={`${styles.segmentedButton} ${rangeId === option.id ? styles.segmentedButtonOn : ''}`}
              onClick={() => setRangeId(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className={styles.periodLabel}>
          <CalendarRange size={15} aria-hidden="true" />
          {range.label.charAt(0).toUpperCase() + range.label.slice(1)}
        </span>
        <button type="button" className={styles.ghostButton} onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spin : undefined} />
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <KpiGrid columns={3}>
            {tiles.map((tile) => (
              <KpiCard
                key={tile.key}
                icon={tile.icon}
                label={tile.label}
                value={formatNumber(tile.value)}
                delta={computeDelta(tile.value, tile.prev)}
                deltaLabel="el periodo anterior"
                hint={`antes: ${formatNumber(tile.prev)}`}
                tone={tile.tone}
              />
            ))}
          </KpiGrid>

          <QrScansPanel
            total={now.qr.total}
            previousTotal={qrPreviousTotal}
            reservas={now.qr.reservas}
            carta={now.qr.carta}
            promo={now.qr.promo}
            reservationsFromQr={now.reservationsFromQr}
            daily={qrScansByDay(range.months, now.daily)}
            boards={qrBoards}
            promos={qrPromos}
            periodLabel={range.label}
          />

          <div className={styles.chartsGrid}>
            <ReportCard
              wide
              icon={Eye}
              title="Visitas por día"
              subtitle={bestDay && bestDay.views > 0
                ? `${formatNumber(totalDaily)} visitas · el mejor día fue el ${Number(bestDay.day.slice(8))} con ${bestDay.views}`
                : 'Visitas a tu ficha cada día'}
            >
              {now.daily.length === 0 ? (
                <EmptyState icon={Eye} title="Sin datos todavía" text="Las visitas aparecen en cuanto alguien abre tu ficha." />
              ) : (
                <div className={styles.dailyChart} role="img" aria-label="Visitas por día">
                  {now.daily.map((point) => (
                    <div key={point.day} className={styles.dailyCol} title={`Día ${Number(point.day.slice(8))}: ${point.views} visitas`}>
                      <span className={styles.dailyTrack}>
                        <span
                          className={`${styles.dailyBar} ${bestDay?.day === point.day ? styles.dailyBarBest : ''}`}
                          style={{ height: `${Math.max(3, (point.views / maxDaily) * 100)}%` }}
                        />
                      </span>
                      <span className={styles.dailyLabel}>{Number(point.day.slice(8))}</span>
                    </div>
                  ))}
                </div>
              )}
            </ReportCard>

            <ReportCard icon={Filter} title="De promo a reserva" subtitle="Cuánta gente avanza en cada paso">
              <div className={styles.funnel}>
                {funnelSteps.map((step, index) => (
                  <div key={step.label} className={styles.funnelStep}>
                    <div className={styles.funnelRow}>
                      <span>{step.label}</span>
                      <strong>{formatNumber(step.value)}</strong>
                    </div>
                    <span className={styles.funnelTrack}>
                      <span style={{ width: `${Math.max(step.value ? 4 : 0, (step.value / funnelMax) * 100)}%`, opacity: 1 - index * 0.2 }} />
                    </span>
                    {index > 0 ? (
                      <span className={styles.funnelRate}>
                        {percent(step.value, funnelSteps[index - 1].value)} % del paso anterior
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </ReportCard>

            <ReportCard icon={Search} title="Búsquedas y favoritos" subtitle="Cómo te encuentran y te guardan">
              <dl className={styles.miniStats}>
                <div>
                  <dt>Apareciste en búsquedas</dt>
                  <dd>{formatNumber(now.searchImpressions)}</dd>
                </div>
                <div>
                  <dt>Te abrieron desde la búsqueda</dt>
                  <dd>
                    {formatNumber(now.searchClicks)}
                    <small>{searchCtr} %</small>
                  </dd>
                </div>
                <div>
                  <dt>
                    <Heart size={13} aria-hidden="true" /> Te guardaron en favoritos
                  </dt>
                  <dd>
                    {formatNumber(now.favoritesAdd)}
                    {now.favoritesRemove > 0 ? <small>−{now.favoritesRemove} quitados</small> : null}
                  </dd>
                </div>
                <div>
                  <dt>Reservas desde tu ficha</dt>
                  <dd>{formatNumber(now.reservationsFromProfile)}</dd>
                </div>
              </dl>
              {favoritesNet !== 0 ? (
                <p className={styles.miniNote}>
                  Balance de favoritos: {favoritesNet > 0 ? `+${favoritesNet}` : favoritesNet} en el periodo.
                </p>
              ) : null}
            </ReportCard>
          </div>

          <TableCard title="Cartas más vistas" meta={`Aperturas de cada carta · ${range.label}`}>
            {topBoards.length === 0 ? (
              <EmptyState icon={BookOpen} title="Nadie ha abierto una carta concreta todavía" />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '3rem' }}>#</th>
                      <th scope="col">Carta</th>
                      <th scope="col" style={{ width: '40%' }}>Peso</th>
                      <th scope="col" className={styles.num}>Aperturas</th>
                      <th scope="col" className={styles.num}>Por QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topBoards.map((board, index) => (
                      <tr key={board.id}>
                        <td><span className={`${styles.rank} ${index < 3 ? styles.rankTop : ''}`}>{index + 1}</span></td>
                        <td><strong>{board.name}</strong></td>
                        <td><InlineBar value={board.count} max={maxBoard} /></td>
                        <td className={styles.num}>{formatNumber(board.count)}</td>
                        <td className={styles.num}>{formatNumber(board.qrScans)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TableCard>

          <TableCard title="Promociones con más tirón" meta={`Vistas, reclamos y reservas · ${range.label}`}>
            {topPromos.length === 0 ? (
              <EmptyState icon={Tag} title="Sin datos de promociones todavía" />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Promoción</th>
                      <th scope="col" className={styles.num}>Vistas</th>
                      <th scope="col" className={styles.num}>Reclamos</th>
                      <th scope="col" className={styles.num}>Clics reservar</th>
                      <th scope="col" className={styles.num}>Reservas</th>
                      <th scope="col" className={styles.num}>Escaneos QR</th>
                      <th scope="col" className={styles.num}>Conversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPromos.map((promo) => (
                      <tr key={promo.id}>
                        <td><strong>{promo.name}</strong></td>
                        <td className={styles.num}>{formatNumber(promo.views)}</td>
                        <td className={styles.num}>{formatNumber(promo.claims)}</td>
                        <td className={styles.num}>{formatNumber(promo.reserveClicks)}</td>
                        <td className={styles.num}>{formatNumber(promo.reservations)}</td>
                        <td className={styles.num}>{formatNumber(promo.qrScans)}</td>
                        <td className={styles.num}>
                          <span className={`${styles.chip} ${promo.reservations > 0 ? styles.chipOk : styles.chipMuted}`}>
                            {percent(promo.reservations, promo.views)} %
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TableCard>
        </>
      )}
    </div>
  )
}

export default CompanyReportsApp
