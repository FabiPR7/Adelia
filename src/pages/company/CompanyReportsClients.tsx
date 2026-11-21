import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Hourglass, Repeat, Sparkles, TrendingUp, UserPlus, Users, UsersRound } from 'lucide-react'
import ClientRetentionChart from '../../components/reports/ClientRetentionChart'
import ClientTrendChart from '../../components/reports/ClientTrendChart'
import ReservationWeekdayChart from '../../components/reports/ReservationWeekdayChart'
import SortableTh from '../../components/reports/SortableTh'
import {
  ChartsGrid,
  computeDelta,
  EmptyState,
  formatNumber,
  InlineBar,
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
import { COMPANY_RESERVATION_RANGE_LIMIT, reportYearOptions, yearBounds } from '../../services/firestoreQuery'
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
  getReportDateRange,
  type ReportPeriodConfig,
} from '../../utils/clientReports'
import { downloadExcelFile, formatExcelDate } from '../../utils/exportSpreadsheet'
import { formatDateSpanish } from '../../utils/helpers'

type ClientSortKey = 'name' | 'reservations' | 'totalPax' | 'firstVisit' | 'lastVisit'

const CLIENT_SORT_DEFAULTS: Record<ClientSortKey, SortState['direction']> = {
  name: 'asc',
  reservations: 'desc',
  totalPax: 'desc',
  firstVisit: 'desc',
  lastVisit: 'desc',
}

const PAGE_STEP = 50

interface CompanyReportsClientsProps {
  companyId: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function CompanyReportsClients({ companyId }: CompanyReportsClientsProps) {
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
  const [sort, setSort] = useState<SortState>({ key: 'lastVisit', direction: 'desc' })
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)

  const [truncated, setTruncated] = useState(false)

  const loadReservations = useCallback(async () => {
    if (!companyId) {
      setError('No se encontró la empresa activa.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const range = yearBounds(config.year)
      const data = await getReservationsByCompany(companyId, { from: range.start, to: range.end })
      setReservations(data)
      setTruncated(data.length >= COMPANY_RESERVATION_RANGE_LIMIT)
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
  }, [query, sort, config.year])

  const availableYears = useMemo(() => reportYearOptions(), [])

  const periodReservations = useMemo(
    () => filterReservationsInRange(reservations, getReportDateRange(config)),
    [reservations, config],
  )
  const periodEnd = useMemo(() => getReportDateRange(config).end, [config])

  const kpis = useMemo(
    () => computeClientKpis(periodReservations, reservations, config),
    [periodReservations, reservations, config],
  )

  const previousConfig = previousPeriodConfig(config)
  const previousKpis = useMemo(() => {
    if (!previousConfig) {
      return null
    }
    const prevReservations = filterReservationsInRange(reservations, getReportDateRange(previousConfig))
    return computeClientKpis(prevReservations, reservations, previousConfig)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservations, previousConfig?.granularity, previousConfig?.month, previousConfig?.quarter, previousConfig?.year])

  const trendData = useMemo(
    () => computeClientTrendData(periodReservations, reservations, config),
    [periodReservations, reservations, config],
  )
  const frequencyData = useMemo(() => computeVisitFrequencyData(periodReservations), [periodReservations])
  const retentionData = useMemo(() => computeRetentionData(reservations, config), [reservations, config])
  const recencyData = useMemo(() => computeRecencyData(reservations, periodEnd), [reservations, periodEnd])
  const clientsDirectory = useMemo(() => computeClientsDirectory(reservations), [reservations])

  const maxReservations = useMemo(
    () => Math.max(1, ...clientsDirectory.map((client) => client.reservations)),
    [clientsDirectory],
  )

  const sortedClientsList = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const list = normalized
      ? clientsDirectory.filter((client) =>
        `${client.name} ${client.email} ${client.phone}`.toLowerCase().includes(normalized))
      : [...clientsDirectory]

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
  }, [clientsDirectory, sort, query])

  const handleClientSort = useCallback((key: string) => {
    setSort((current) => nextSortState(current, key, CLIENT_SORT_DEFAULTS[key as ClientSortKey] ?? 'asc'))
  }, [])

  const periodLabel = formatReportPeriodLabel(config)
  const prevLabel = previousPeriodLabel(config)
  const repeatRate = kpis.total > 0 ? Math.round((kpis.recurring / kpis.total) * 100) : 0
  const prevRepeatRate = previousKpis && previousKpis.total > 0
    ? Math.round((previousKpis.recurring / previousKpis.total) * 100)
    : null

  const handleDownloadClients = () => {
    downloadExcelFile(
      `clientes-${config.year}.csv`,
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
    <div className={styles.page}>
      <ReportHeader
        title="Informe de clientes"
        subtitle="Quién llega por primera vez, quién vuelve y cada cuánto. Nuevo: su primer mes; recurrente: vuelve otro mes."
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
      {truncated ? (
        <div className={styles.error} role="status">
          Este periodo tiene más de {COMPANY_RESERVATION_RANGE_LIMIT} reservas y solo se cuentan las
          primeras. Elige un periodo más corto (mes o trimestre) para ver las cifras completas.
        </div>
      ) : null}

      {loading && reservations.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          <KpiGrid columns={4}>
            <KpiCard
              icon={Users}
              label="Clientes"
              value={formatNumber(kpis.total)}
              delta={computeDelta(kpis.total, previousKpis?.total)}
              deltaLabel={prevLabel}
              hint={previousKpis ? `vs. ${prevLabel}` : 'en el periodo'}
              tone="info"
            />
            <KpiCard
              icon={UserPlus}
              label="Nuevos"
              value={formatNumber(kpis.newClients)}
              delta={computeDelta(kpis.newClients, previousKpis?.newClients)}
              deltaLabel={prevLabel}
              tone="good"
            />
            <KpiCard
              icon={Repeat}
              label="Recurrentes"
              value={formatNumber(kpis.recurring)}
              delta={computeDelta(kpis.recurring, previousKpis?.recurring)}
              deltaLabel={prevLabel}
            />
            <KpiCard
              icon={Sparkles}
              label="Tasa de repetición"
              value={repeatRate}
              suffix="%"
              delta={prevRepeatRate != null ? computeDelta(repeatRate, prevRepeatRate) : null}
              deltaLabel={prevLabel}
              hint="de los clientes ya habían venido"
              tone="warn"
            />
          </KpiGrid>

          <ChartsGrid>
            <ReportCard
              wide
              icon={TrendingUp}
              title="Entrada de clientes"
              subtitle={`Nuevos y recurrentes a lo largo del periodo · ${periodLabel}`}
            >
              <ClientTrendChart data={trendData} />
            </ReportCard>
            <ReportCard icon={UsersRound} title="Frecuencia de visita" subtitle="Cuántas veces reserva cada cliente">
              <ReservationWeekdayChart data={frequencyData} />
            </ReportCard>
            <ReportCard icon={Hourglass} title="Recencia" subtitle="Hace cuánto volvieron los recurrentes">
              <ReservationWeekdayChart data={recencyData} />
            </ReportCard>
            <ReportCard
              wide
              icon={CalendarClock}
              title="Retención mes a mes"
              subtitle={`Clientes captados y cuántos vuelven al mes siguiente · ${periodLabel}`}
            >
              <ClientRetentionChart data={retentionData} />
            </ReportCard>
          </ChartsGrid>

          <TableCard
            title="Clientes del año"
            meta={`${sortedClientsList.length} ${sortedClientsList.length === 1 ? 'cliente' : 'clientes'} con reservas en ${config.year}`}
            search={{ value: query, onChange: setQuery, placeholder: 'Buscar cliente, correo o teléfono' }}
            onDownload={handleDownloadClients}
            downloadDisabled={sortedClientsList.length === 0}
            footer={sortedClientsList.length > visibleCount ? (
              <>
                <span>Mostrando {visibleCount} de {sortedClientsList.length}</span>
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
            {sortedClientsList.length === 0 ? (
              <EmptyState
                icon={Users}
                title={query.trim() ? 'Ningún cliente coincide' : 'Aún no hay clientes este año'}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh label="Cliente" sortKey="name" sort={sort} onSort={handleClientSort} />
                      <th scope="col">Teléfono</th>
                      <SortableTh label="Reservas" sortKey="reservations" sort={sort} onSort={handleClientSort} />
                      <SortableTh label="Comensales" sortKey="totalPax" sort={sort} onSort={handleClientSort} />
                      <SortableTh label="Primera visita" sortKey="firstVisit" sort={sort} onSort={handleClientSort} />
                      <SortableTh label="Última visita" sortKey="lastVisit" sort={sort} onSort={handleClientSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClientsList.slice(0, visibleCount).map((client) => (
                      <tr key={client.key}>
                        <td>
                          <span className={styles.personCell}>
                            <span className={styles.avatar} aria-hidden="true">{initials(client.name)}</span>
                            <span className={styles.personText}>
                              <strong>{client.name}</strong>
                              {client.email ? <span>{client.email}</span> : null}
                            </span>
                          </span>
                        </td>
                        <td className={`${styles.nowrap} ${styles.muted}`}>{client.phone || '—'}</td>
                        <td>
                          <span className={styles.personCell} style={{ minWidth: '8rem' }}>
                            <strong>{client.reservations}</strong>
                            <InlineBar value={client.reservations} max={maxReservations} />
                          </span>
                        </td>
                        <td>{client.totalPax}</td>
                        <td className={`${styles.nowrap} ${styles.muted}`}>{formatDateSpanish(client.firstVisit)}</td>
                        <td className={styles.nowrap}>{formatDateSpanish(client.lastVisit)}</td>
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

export default CompanyReportsClients
