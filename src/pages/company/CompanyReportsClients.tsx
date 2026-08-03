import { useCallback, useEffect, useMemo, useState } from 'react'
import ClientRetentionChart from '../../components/reports/ClientRetentionChart'
import ClientTrendChart from '../../components/reports/ClientTrendChart'
import ReservationWeekdayChart from '../../components/reports/ReservationWeekdayChart'
import SortableTh from '../../components/reports/SortableTh'
import { getFirestoreErrorMessage, getReservationsByCompany } from '../../services/firestore'
import type { Reservation } from '../../types'
import {
  compareDates,
  compareNumbers,
  compareStrings,
  nextSortState,
  type SortState,
} from '../../utils/tableSort'
import {
  computeClientKpis,
  computeClientTrendData,
  computeClientsDirectory,
  computeRecencyData,
  computeRetentionData,
  computeVisitFrequencyData,
  filterReservationsInRange,
  formatReportPeriodLabel,
  getAvailableYears,
  getReportDateRange,
  type ReportGranularity,
  type ReportPeriodConfig,
} from '../../utils/clientReports'
import { downloadExcelFile, formatExcelDate } from '../../utils/exportSpreadsheet'
import { formatDateSpanish } from '../../utils/helpers'
import styles from './CompanyReportsClients.module.css'

type ClientSortKey = 'name' | 'reservations' | 'totalPax' | 'firstVisit' | 'lastVisit'

const CLIENT_SORT_DEFAULTS: Record<ClientSortKey, SortState['direction']> = {
  name: 'asc',
  reservations: 'desc',
  totalPax: 'desc',
  firstVisit: 'desc',
  lastVisit: 'desc',
}

interface CompanyReportsClientsProps {
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

function CompanyReportsClients({ companyId }: CompanyReportsClientsProps) {
  const now = new Date()
  const [granularity, setGranularity] = useState<ReportGranularity>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'lastVisit', direction: 'desc' })

  const loadReservations = useCallback(async () => {
    if (!companyId) {
      setError('No se encontró la empresa activa.')
      setLoading(false)
      return
    }

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

  const periodEnd = useMemo(() => getReportDateRange(periodConfig).end, [periodConfig])

  const kpis = useMemo(
    () => computeClientKpis(periodReservations, reservations, periodConfig),
    [periodReservations, reservations, periodConfig],
  )
  const trendData = useMemo(
    () => computeClientTrendData(periodReservations, reservations, periodConfig),
    [periodReservations, reservations, periodConfig],
  )
  const frequencyData = useMemo(
    () => computeVisitFrequencyData(periodReservations),
    [periodReservations],
  )
  const retentionData = useMemo(
    () => computeRetentionData(reservations, periodConfig),
    [reservations, periodConfig],
  )
  const recencyData = useMemo(
    () => computeRecencyData(reservations, periodEnd),
    [reservations, periodEnd],
  )
  const clientsDirectory = useMemo(
    () => computeClientsDirectory(reservations),
    [reservations],
  )

  const sortedClientsList = useMemo(() => {
    const list = [...clientsDirectory]

    list.sort((left, right) => {
      switch (sort.key as ClientSortKey) {
        case 'name':
          return compareStrings(left.name, right.name, sort.direction)
        case 'reservations':
          return compareNumbers(left.reservations, right.reservations, sort.direction)
        case 'totalPax':
          return compareNumbers(left.totalPax, right.totalPax, sort.direction)
        case 'firstVisit':
          return compareDates(left.firstVisit, right.firstVisit, sort.direction)
        case 'lastVisit':
        default:
          return compareDates(left.lastVisit, right.lastVisit, sort.direction)
      }
    })

    return list
  }, [clientsDirectory, sort])

  const handleClientSort = useCallback((key: string) => {
    setSort((current) => nextSortState(
      current,
      key,
      CLIENT_SORT_DEFAULTS[key as ClientSortKey] ?? 'asc',
    ))
  }, [])

  const periodLabel = formatReportPeriodLabel(periodConfig)

  const handleDownloadClients = () => {
    downloadExcelFile(
      'clientes-adelia.csv',
      ['Nombre', 'Email', 'Teléfono', 'Reservas', 'Comensales', 'Primera visita', 'Última visita'],
      sortedClientsList.map((client) => [
        client.name,
        client.email,
        client.phone,
        client.reservations,
        client.totalPax,
        formatExcelDate(client.firstVisit),
        formatExcelDate(client.lastVisit),
      ]),
    )
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>Informes de clientes</h2>
        <p>
          Nuevo en su primer mes; recurrente si vuelve en otro mes. Captación, frecuencia, retención y recencia.
        </p>
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
              <div className={styles.kpiInline} aria-label="Resumen de clientes">
                <span className={`${styles.kpiChip} ${styles.kpiChipTotal}`}>
                  <span className={styles.kpiLabel}>Total</span>
                  <strong className={styles.kpiValue}>{kpis.total}</strong>
                </span>
                <span className={`${styles.kpiChip} ${styles.kpiChipNew}`}>
                  <span className={styles.kpiLabel}>Nuevos</span>
                  <strong className={styles.kpiValue}>{kpis.newClients}</strong>
                </span>
                <span className={`${styles.kpiChip} ${styles.kpiChipRecurring}`}>
                  <span className={styles.kpiLabel}>Recurrentes</span>
                  <strong className={styles.kpiValue}>{kpis.recurring}</strong>
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
                  <h3>Entrada de clientes</h3>
                  <p className={styles.chartSubtitle}>
                    Cuándo entran nuevos y cuándo vuelven los recurrentes · {periodLabel}
                  </p>
                </div>
                <ClientTrendChart data={trendData} />
              </section>

              <section className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3>Frecuencia de visita</h3>
                  <p className={styles.chartSubtitle}>Cuántas veces reserva cada cliente en el periodo</p>
                </div>
                <ReservationWeekdayChart data={frequencyData} />
              </section>

              <section className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3>Recencia</h3>
                  <p className={styles.chartSubtitle}>Hace cuánto volvieron los clientes recurrentes</p>
                </div>
                <ReservationWeekdayChart data={recencyData} />
              </section>

              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Retención mes a mes</h3>
                  <p className={styles.chartSubtitle}>
                    Clientes captados y cuántos vuelven al mes siguiente · {periodLabel}
                  </p>
                </div>
                <ClientRetentionChart data={retentionData} />
              </section>
            </div>

            <section className={styles.listSection}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderText}>
                  <h3>Lista de clientes</h3>
                  <p className={styles.listMeta}>
                    {sortedClientsList.length} cliente{sortedClientsList.length === 1 ? '' : 's'} · historial completo
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.downloadButton}
                  onClick={handleDownloadClients}
                  disabled={sortedClientsList.length === 0}
                >
                  Descargar Excel
                </button>
              </div>

              {sortedClientsList.length === 0 ? (
                <div className={styles.emptyList}>No hay clientes registrados todavía.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <SortableTh label="Cliente" sortKey="name" sort={sort} onSort={handleClientSort} />
                        <th scope="col">Email</th>
                        <th scope="col">Teléfono</th>
                        <SortableTh label="Reservas" sortKey="reservations" sort={sort} onSort={handleClientSort} />
                        <SortableTh label="Comensales" sortKey="totalPax" sort={sort} onSort={handleClientSort} />
                        <SortableTh label="Primera visita" sortKey="firstVisit" sort={sort} onSort={handleClientSort} />
                        <SortableTh label="Última visita" sortKey="lastVisit" sort={sort} onSort={handleClientSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClientsList.map((client) => (
                        <tr key={client.key}>
                          <td>{client.name}</td>
                          <td>{client.email || '—'}</td>
                          <td>{client.phone || '—'}</td>
                          <td>{client.reservations}</td>
                          <td>{client.totalPax}</td>
                          <td>{formatDateSpanish(client.firstVisit)}</td>
                          <td>{formatDateSpanish(client.lastVisit)}</td>
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

export default CompanyReportsClients
