import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  CalendarX,
  ChartColumn,
  CircleCheck,
  Clock,
  PieChart,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import ReservationHourSlotsChart from '../../components/reports/ReservationHourSlotsChart'
import ReservationStatusDonut from '../../components/reports/ReservationStatusDonut'
import ReservationTrendChart from '../../components/reports/ReservationTrendChart'
import ReservationWeekdayChart from '../../components/reports/ReservationWeekdayChart'
import SortableTh from '../../components/reports/SortableTh'
import {
  ChartsGrid,
  computeDelta,
  EmptyState,
  formatNumber,
  KpiCard,
  KpiGrid,
  LoadingState,
  previousPeriodConfig,
  previousPeriodLabel,
  ReportCard,
  ReportHeader,
  ReportPeriodBar,
  reportStyles as styles,
  TableCard,
} from '../../components/reports/ReportKit'
import { getFirestoreErrorMessage, getReservationsByCompany } from '../../services/firestore'
import { reportYearOptions, yearBounds } from '../../services/firestoreQuery'
import type { Reservation } from '../../types'
import { formatDateSpanish, formatTimeSpanish } from '../../utils/helpers'
import { downloadExcelFile, formatExcelDate, formatExcelDateTime } from '../../utils/exportSpreadsheet'
import {
  compareDates,
  compareNumbers,
  compareStrings,
  nextSortState,
  type SortState,
} from '../../utils/tableSort'
import {
  computeHourSlotChartData,
  computeStatusDistribution,
  computeTrendChartData,
  computeWeekdayChartData,
  filterReservationsInRange,
  formatReportPeriodLabel,
  getReportDateRange,
  type ReportPeriodConfig,
} from '../../utils/reservationReports'

type ReservationSortKey = 'name' | 'startTime' | 'pax' | 'createdAt'

const RESERVATION_SORT_DEFAULTS: Record<ReservationSortKey, SortState['direction']> = {
  name: 'asc',
  startTime: 'desc',
  pax: 'desc',
  createdAt: 'desc',
}

const PAGE_STEP = 50

interface CompanyReportsReservationsProps {
  companyId: string
}

/** Estado como lo entiende el local (el servidor guarda las activas como `completed`). */
function reservationStatus(reservation: Reservation, now: number): { label: string; className: string } {
  if (reservation.status === 'cancelled') {
    return reservation.noShow
      ? { label: 'No vino', className: styles.chipBad }
      : { label: 'Cancelada', className: styles.chipMuted }
  }
  if (reservation.status === 'confirmed') return { label: 'Asistió', className: styles.chipOk }
  return reservation.startTime.getTime() <= now
    ? { label: 'Por marcar', className: styles.chipWarn }
    : { label: 'Reservada', className: styles.chipInfo }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function summarize(list: Reservation[]) {
  const cancelled = list.filter((row) => row.status === 'cancelled')
  const attended = list.filter((row) => row.status === 'confirmed')
  const pax = list.filter((row) => row.status !== 'cancelled').reduce((sum, row) => sum + (row.pax || 0), 0)
  return {
    total: list.length,
    attended: attended.length,
    cancelled: cancelled.length,
    noShows: cancelled.filter((row) => row.noShow).length,
    pax,
  }
}

function CompanyReportsReservations({ companyId }: CompanyReportsReservationsProps) {
  const now = new Date()
  const [config, setConfig] = useState<ReportPeriodConfig>({
    granularity: 'monthly',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    quarter: Math.floor(now.getMonth() / 3) + 1,
  })
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'startTime', direction: 'desc' })
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)

  const loadReservations = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const range = yearBounds(config.year)
      const data = await getReservationsByCompany(companyId, { from: range.start, to: range.end })
      setReservations(data)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [companyId, config.year])

  useEffect(() => {
    void loadReservations()
  }, [loadReservations])

  useEffect(() => {
    setVisibleCount(PAGE_STEP)
  }, [config, query, sort])

  const availableYears = useMemo(() => reportYearOptions(), [])

  const periodReservations = useMemo(
    () => filterReservationsInRange(reservations, getReportDateRange(config)),
    [reservations, config],
  )

  const previousConfig = previousPeriodConfig(config)
  const previousReservations = useMemo(
    () => (previousConfig ? filterReservationsInRange(reservations, getReportDateRange(previousConfig)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reservations, previousConfig?.month, previousConfig?.quarter, previousConfig?.granularity, previousConfig?.year],
  )

  const current = useMemo(() => summarize(periodReservations), [periodReservations])
  const previous = useMemo(() => (previousReservations ? summarize(previousReservations) : null), [previousReservations])

  const trendData = useMemo(() => computeTrendChartData(periodReservations, config), [periodReservations, config])
  const statusData = useMemo(() => computeStatusDistribution(periodReservations), [periodReservations])
  const weekdayData = useMemo(() => computeWeekdayChartData(periodReservations), [periodReservations])
  const hourSlotData = useMemo(() => computeHourSlotChartData(periodReservations), [periodReservations])

  const busiestDay = useMemo(() => {
    let bestIndex = -1
    weekdayData.values.forEach((value, index) => {
      if (value > 0 && (bestIndex === -1 || value > weekdayData.values[bestIndex])) bestIndex = index
    })
    const fullNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
    return bestIndex >= 0 ? fullNames[bestIndex] ?? weekdayData.labels[bestIndex] : null
  }, [weekdayData])

  const filteredList = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const list = normalized
      ? periodReservations.filter((row) =>
        `${row.clientName} ${row.clientEmail} ${row.clientPhone}`.toLowerCase().includes(normalized))
      : [...periodReservations]

    list.sort((left, right) => {
      switch (sort.key as ReservationSortKey) {
        case 'name':
          return compareStrings(left.clientName, right.clientName, sort.direction)
        case 'pax':
          return compareNumbers(left.pax, right.pax, sort.direction)
        case 'createdAt':
          return compareDates(left.createdAt, right.createdAt, sort.direction)
        case 'startTime':
        default:
          return compareDates(left.startTime, right.startTime, sort.direction)
      }
    })

    return list
  }, [periodReservations, query, sort])

  const handleSort = useCallback((key: string) => {
    setSort((currentSort) => nextSortState(
      currentSort,
      key,
      RESERVATION_SORT_DEFAULTS[key as ReservationSortKey] ?? 'asc',
    ))
  }, [])

  const periodLabel = formatReportPeriodLabel(config)
  const prevLabel = previousPeriodLabel(config)
  const nowMs = Date.now()
  const pct = (value: number) => (current.total > 0 ? Math.round((value / current.total) * 100) : 0)

  const handleDownload = () => {
    downloadExcelFile(
      `reservas-${periodLabel.replaceAll(' ', '-')}.csv`,
      ['Cliente', 'Email', 'Teléfono', 'Fecha reserva', 'Hora', 'Comensales', 'Estado', 'Creada el'],
      filteredList.map((reservation) => [
        reservation.clientName,
        reservation.clientEmail,
        reservation.clientPhone,
        formatExcelDate(reservation.startTime),
        formatTimeSpanish(reservation.startTime),
        reservation.pax,
        reservationStatus(reservation, nowMs).label,
        formatExcelDateTime(reservation.createdAt),
      ]),
    )
  }

  return (
    <div className={styles.page}>
      <ReportHeader
        title="Informe de reservas"
        subtitle="Cuántas reservas recibes, cuántas se cumplen y cuándo tienes más demanda."
      />

      <ReportPeriodBar
        config={config}
        years={availableYears}
        periodLabel={periodLabel}
        loading={loading}
        onChange={setConfig}
        onRefresh={() => void loadReservations()}
      />

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      {loading && reservations.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          <KpiGrid columns={4}>
            <KpiCard
              icon={CalendarDays}
              label="Reservas"
              value={formatNumber(current.total)}
              delta={computeDelta(current.total, previous?.total)}
              deltaLabel={prevLabel}
              hint={previous ? `vs. ${prevLabel}` : undefined}
              tone="info"
            />
            <KpiCard
              icon={UsersRound}
              label="Comensales"
              value={formatNumber(current.pax)}
              delta={computeDelta(current.pax, previous?.pax)}
              deltaLabel={prevLabel}
              hint={current.total - current.cancelled > 0
                ? `${formatNumber(current.pax / (current.total - current.cancelled), 1)} de media por mesa`
                : undefined}
            />
            <KpiCard
              icon={CircleCheck}
              label="Asistieron"
              value={formatNumber(current.attended)}
              suffix={current.total ? `· ${pct(current.attended)} %` : undefined}
              delta={computeDelta(current.attended, previous?.attended)}
              deltaLabel={prevLabel}
              tone="good"
            />
            <KpiCard
              icon={CalendarX}
              label="Canceladas"
              value={formatNumber(current.cancelled)}
              suffix={current.total ? `· ${pct(current.cancelled)} %` : undefined}
              delta={computeDelta(current.cancelled, previous?.cancelled, true)}
              deltaLabel={prevLabel}
              hint={current.noShows > 0 ? `${current.noShows} no vinieron` : undefined}
              tone={current.cancelled > 0 ? 'bad' : 'default'}
            />
          </KpiGrid>

          <ChartsGrid>
            <ReportCard
              wide
              icon={TrendingUp}
              title="Evolución"
              subtitle={`Reservas por estado · ${periodLabel}`}
            >
              <ReservationTrendChart data={trendData} />
            </ReportCard>
            <ReportCard icon={PieChart} title="Estados" subtitle="Cómo terminan las reservas del periodo">
              <ReservationStatusDonut data={statusData} />
            </ReportCard>
            <ReportCard
              icon={CalendarCheck}
              title="Días con más reservas"
              subtitle={busiestDay ? `El día más fuerte es el ${busiestDay}` : 'Qué días concentran la demanda'}
            >
              <ReservationWeekdayChart data={weekdayData} />
            </ReportCard>
            <ReportCard
              wide
              icon={Clock}
              title="Franjas horarias"
              subtitle={`Comida y cena en bloques de 2 horas · ${periodLabel}`}
            >
              <ReservationHourSlotsChart data={hourSlotData} />
            </ReportCard>
          </ChartsGrid>

          <TableCard
            title="Reservas del periodo"
            meta={`${filteredList.length} ${filteredList.length === 1 ? 'reserva' : 'reservas'} · ${periodLabel}`}
            search={{ value: query, onChange: setQuery, placeholder: 'Buscar cliente, correo o teléfono' }}
            onDownload={handleDownload}
            downloadDisabled={filteredList.length === 0}
            footer={filteredList.length > visibleCount ? (
              <>
                <span>Mostrando {visibleCount} de {filteredList.length}</span>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setVisibleCount((count) => count + PAGE_STEP)}
                >
                  Mostrar más
                </button>
              </>
            ) : undefined}
          >
            {filteredList.length === 0 ? (
              <EmptyState
                icon={ChartColumn}
                title={query.trim() ? 'Ninguna reserva coincide' : 'Sin reservas en este periodo'}
                text={query.trim() ? undefined : 'Prueba con otro mes, trimestre o año.'}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh label="Cliente" sortKey="name" sort={sort} onSort={handleSort} />
                      <SortableTh label="Fecha" sortKey="startTime" sort={sort} onSort={handleSort} />
                      <th scope="col">Hora</th>
                      <SortableTh label="Pers." sortKey="pax" sort={sort} onSort={handleSort} />
                      <th scope="col">Estado</th>
                      <SortableTh label="Hecha el" sortKey="createdAt" sort={sort} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.slice(0, visibleCount).map((reservation) => {
                      const status = reservationStatus(reservation, nowMs)
                      return (
                        <tr key={reservation.id}>
                          <td>
                            <span className={styles.personCell}>
                              <span className={styles.avatar} aria-hidden="true">{initials(reservation.clientName)}</span>
                              <span className={styles.personText}>
                                <strong>{reservation.clientName || 'Cliente'}</strong>
                                {reservation.clientEmail ? <span>{reservation.clientEmail}</span> : null}
                              </span>
                            </span>
                          </td>
                          <td className={styles.nowrap}>{formatDateSpanish(reservation.startTime)}</td>
                          <td className={styles.nowrap}>{formatTimeSpanish(reservation.startTime)}</td>
                          <td>{reservation.pax}</td>
                          <td><span className={`${styles.chip} ${status.className}`}>{status.label}</span></td>
                          <td className={`${styles.nowrap} ${styles.muted}`}>
                            {formatDateSpanish(reservation.createdAt)}
                          </td>
                        </tr>
                      )
                    })}
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

export default CompanyReportsReservations
