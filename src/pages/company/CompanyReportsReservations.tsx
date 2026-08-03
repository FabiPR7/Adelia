import { useCallback, useEffect, useMemo, useState } from 'react'
import ReservationHourSlotsChart from '../../components/reports/ReservationHourSlotsChart'
import ReservationStatusDonut from '../../components/reports/ReservationStatusDonut'
import ReservationTrendChart from '../../components/reports/ReservationTrendChart'
import ReservationWeekdayChart from '../../components/reports/ReservationWeekdayChart'
import SortableTh from '../../components/reports/SortableTh'
import { getFirestoreErrorMessage, getReservationsByCompany } from '../../services/firestore'
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
  computeReservationKpis,
  computeStatusDistribution,
  computeTrendChartData,
  computeWeekdayChartData,
  filterReservationsInRange,
  formatReportPeriodLabel,
  getAvailableYears,
  getReportDateRange,
  type ReportGranularity,
  type ReportPeriodConfig,
} from '../../utils/reservationReports'
import styles from './CompanyReportsReservations.module.css'

type ReservationSortKey = 'name' | 'startTime' | 'pax' | 'createdAt'

const RESERVATION_SORT_DEFAULTS: Record<ReservationSortKey, SortState['direction']> = {
  name: 'asc',
  startTime: 'desc',
  pax: 'desc',
  createdAt: 'desc',
}

interface CompanyReportsReservationsProps {
  companyId: string
}

const GRANULARITY_OPTIONS: { id: ReportGranularity; label: string }[] = [
  { id: 'annual', label: 'Anual' },
  { id: 'quarterly', label: 'Trimestral' },
  { id: 'monthly', label: 'Mensual' },
]

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2024, index, 1)),
}))

const QUARTER_OPTIONS = [
  { value: 1, label: 'T1 (Ene – Mar)' },
  { value: 2, label: 'T2 (Abr – Jun)' },
  { value: 3, label: 'T3 (Jul – Sep)' },
  { value: 4, label: 'T4 (Oct – Dic)' },
]

const STATUS_LABELS: Record<Reservation['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Completada',
}

function statusClass(status: Reservation['status']): string {
  if (status === 'confirmed') {
    return styles.statusConfirmed
  }
  if (status === 'cancelled') {
    return styles.statusCancelled
  }
  return styles.statusCompleted
}

function CompanyReportsReservations({ companyId }: CompanyReportsReservationsProps) {
  const now = new Date()
  const [granularity, setGranularity] = useState<ReportGranularity>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' })

  const loadReservations = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getReservationsByCompany(companyId)
      setReservations(data)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadReservations()
  }, [loadReservations])

  const availableYears = useMemo(() => getAvailableYears(reservations), [reservations])

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year)) {
      setYear(availableYears[0])
    }
  }, [availableYears, year])

  const periodConfig = useMemo<ReportPeriodConfig>(
    () => ({ granularity, year, month, quarter }),
    [granularity, year, month, quarter],
  )

  const periodReservations = useMemo(() => {
    const range = getReportDateRange(periodConfig)
    return filterReservationsInRange(reservations, range)
  }, [reservations, periodConfig])

  const kpis = useMemo(() => computeReservationKpis(periodReservations), [periodReservations])
  const trendData = useMemo(
    () => computeTrendChartData(periodReservations, periodConfig),
    [periodReservations, periodConfig],
  )
  const statusData = useMemo(
    () => computeStatusDistribution(periodReservations),
    [periodReservations],
  )
  const weekdayData = useMemo(
    () => computeWeekdayChartData(periodReservations),
    [periodReservations],
  )
  const hourSlotData = useMemo(
    () => computeHourSlotChartData(periodReservations),
    [periodReservations],
  )
  const sortedReservationsList = useMemo(() => {
    const list = [...reservations]

    list.sort((left, right) => {
      switch (sort.key as ReservationSortKey) {
        case 'name':
          return compareStrings(left.clientName, right.clientName, sort.direction)
        case 'startTime':
          return compareDates(left.startTime, right.startTime, sort.direction)
        case 'pax':
          return compareNumbers(left.pax, right.pax, sort.direction)
        case 'createdAt':
        default:
          return compareDates(left.createdAt, right.createdAt, sort.direction)
      }
    })

    return list
  }, [reservations, sort])

  const handleReservationSort = useCallback((key: string) => {
    setSort((current) => nextSortState(
      current,
      key,
      RESERVATION_SORT_DEFAULTS[key as ReservationSortKey] ?? 'asc',
    ))
  }, [])

  const periodLabel = formatReportPeriodLabel(periodConfig)

  const handleDownloadReservations = () => {
    downloadExcelFile(
      'reservas-adelia.csv',
      ['Cliente', 'Email', 'Teléfono', 'Fecha reserva', 'Hora', 'Comensales', 'Estado', 'Creada el'],
      sortedReservationsList.map((reservation) => [
        reservation.clientName,
        reservation.clientEmail,
        reservation.clientPhone,
        formatExcelDate(reservation.startTime),
        formatTimeSpanish(reservation.startTime),
        reservation.pax,
        STATUS_LABELS[reservation.status],
        formatExcelDateTime(reservation.createdAt),
      ]),
    )
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>Informes de reservas</h2>
        <p>Evolución, estados, días fuertes y horas punta del periodo seleccionado.</p>
      </header>

      <div className={styles.scrollArea}>
        <div className={styles.controls}>
          <div className={styles.controlsFilters}>
            <div className={styles.periodToggle} role="radiogroup" aria-label="Tipo de informe">
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={granularity === option.id}
                className={`${styles.periodButton} ${
                  granularity === option.id ? styles.periodButtonActive : ''
                }`}
                onClick={() => setGranularity(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <select
            className={styles.select}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            aria-label="Año"
          >
            {availableYears.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>

          {granularity === 'monthly' && (
            <select
              className={styles.select}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              aria-label="Mes"
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {granularity === 'quarterly' && (
            <select
              className={styles.select}
              value={quarter}
              onChange={(event) => setQuarter(Number(event.target.value))}
              aria-label="Trimestre"
            >
              {QUARTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          </div>

          <div className={styles.controlsSummary}>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => void loadReservations()}
              disabled={loading}
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>

            {!loading || reservations.length > 0 ? (
              <div className={styles.kpiInline} aria-label="Resumen del periodo">
                <span className={`${styles.kpiChip} ${styles.kpiChipTotal}`}>
                  <span className={styles.kpiLabel}>Totales</span>
                  <strong className={styles.kpiValue}>{kpis.total}</strong>
                </span>
                <span className={`${styles.kpiChip} ${styles.kpiChipCancelled}`}>
                  <span className={styles.kpiLabel}>Canceladas</span>
                  <strong className={styles.kpiValue}>{kpis.cancelled}</strong>
                </span>
                <span className={`${styles.kpiChip} ${styles.kpiChipConfirmed}`}>
                  <span className={styles.kpiLabel}>Confirmadas</span>
                  <strong className={styles.kpiValue}>{kpis.confirmed}</strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading && reservations.length === 0 ? (
          <div className={styles.loading}>Cargando informes…</div>
        ) : (
          <>
            <div className={styles.chartsGrid}>
              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Tendencia del periodo</h3>
                  <p className={styles.chartSubtitle}>
                    Volumen apilado por estado · {periodLabel}
                  </p>
                </div>
                <ReservationTrendChart data={trendData} />
              </section>

              <section className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3>Distribución por estado</h3>
                  <p className={styles.chartSubtitle}>Proporción confirmadas, completadas y canceladas</p>
                </div>
                <ReservationStatusDonut data={statusData} />
              </section>

              <section className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3>Días con más reservas</h3>
                  <p className={styles.chartSubtitle}>Qué días de la semana concentran la demanda</p>
                </div>
                <ReservationWeekdayChart data={weekdayData} />
              </section>

              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Franjas horarias</h3>
                  <p className={styles.chartSubtitle}>
                    Comida y cena en bloques de 2 h · {periodLabel}
                  </p>
                </div>
                <ReservationHourSlotsChart data={hourSlotData} />
              </section>
            </div>

            <section className={styles.listSection}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderText}>
                  <h3>Lista de reservas</h3>
                  <p className={styles.listMeta}>
                    {sortedReservationsList.length} reserva{sortedReservationsList.length === 1 ? '' : 's'} · historial completo
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.downloadButton}
                  onClick={handleDownloadReservations}
                  disabled={sortedReservationsList.length === 0}
                >
                  Descargar Excel
                </button>
              </div>

              {sortedReservationsList.length === 0 ? (
                <div className={styles.emptyList}>No hay reservas registradas todavía.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <SortableTh label="Cliente" sortKey="name" sort={sort} onSort={handleReservationSort} />
                        <SortableTh label="Fecha reserva" sortKey="startTime" sort={sort} onSort={handleReservationSort} />
                        <th scope="col">Hora</th>
                        <SortableTh label="Comensales" sortKey="pax" sort={sort} onSort={handleReservationSort} />
                        <th scope="col">Estado</th>
                        <SortableTh label="Creada el" sortKey="createdAt" sort={sort} onSort={handleReservationSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedReservationsList.map((reservation) => (
                        <tr key={reservation.id}>
                          <td>{reservation.clientName}</td>
                          <td>{formatDateSpanish(reservation.startTime)}</td>
                          <td>{formatTimeSpanish(reservation.startTime)}</td>
                          <td>{reservation.pax}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${statusClass(reservation.status)}`}>
                              {STATUS_LABELS[reservation.status]}
                            </span>
                          </td>
                          <td>
                            {formatDateSpanish(reservation.createdAt)}{' '}
                            {formatTimeSpanish(reservation.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default CompanyReportsReservations
