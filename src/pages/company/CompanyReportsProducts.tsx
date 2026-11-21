import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Clock,
  Euro,
  Package,
  PieChart,
  Receipt,
  ShoppingBasket,
  Trophy,
  TrendingUp,
} from 'lucide-react'
import ProductModeDonut from '../../components/reports/ProductModeDonut'
import ProductRevenueTrendChart from '../../components/reports/ProductRevenueTrendChart'
import ProductTopBarChart from '../../components/reports/ProductTopBarChart'
import ReservationHourSlotsChart from '../../components/reports/ReservationHourSlotsChart'
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
import {
  getFirestoreErrorMessage,
  getVerifiedConsumptionsByCompany,
} from '../../services/firestore'
import { reportYearOptions } from '../../services/firestoreQuery'
import { fetchYearReservationsForReports } from '../../services/companyReports'
import type { VerifiedConsumptionRecord } from '../../types/verifiedConsumption'
import { formatDateSpanish, formatTimeSpanish } from '../../utils/helpers'
import { formatCentsAsEuros } from '../../utils/minimumSpendVerification'
import { downloadExcelFile, formatExcelDate, formatExcelDateTime } from '../../utils/exportSpreadsheet'
import {
  compareDates,
  compareNumbers,
  compareStrings,
  nextSortState,
  type SortState,
} from '../../utils/tableSort'
import {
  computeModeDistribution,
  computeProductHourChartData,
  computeProductKpis,
  computeProductTrendChartData,
  computeTopProducts,
  filterVerifiedInRange,
  formatReportPeriodLabel,
  getReportDateRange,
  mergeVerifiedConsumptions,
} from '../../utils/productReports'
import type { ReportPeriodConfig } from '../../utils/reservationReports'

type ProductSortKey = 'name' | 'quantity' | 'revenue'
type VerificationSortKey = 'clientName' | 'startTime' | 'totalCents' | 'verifiedAt'

const PRODUCT_SORT_DEFAULTS: Record<ProductSortKey, SortState['direction']> = {
  name: 'asc',
  quantity: 'desc',
  revenue: 'desc',
}

const VERIFICATION_SORT_DEFAULTS: Record<VerificationSortKey, SortState['direction']> = {
  clientName: 'asc',
  startTime: 'desc',
  totalCents: 'desc',
  verifiedAt: 'desc',
}

interface CompanyReportsProductsProps {
  companyId: string
}

function CompanyReportsProducts({ companyId }: CompanyReportsProductsProps) {
  const now = new Date()
  const [config, setConfig] = useState<ReportPeriodConfig>({
    granularity: 'monthly',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    quarter: Math.floor(now.getMonth() / 3) + 1,
  })
  const [records, setRecords] = useState<VerifiedConsumptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productSort, setProductSort] = useState<SortState>({ key: 'quantity', direction: 'desc' })
  const [verificationSort, setVerificationSort] = useState<SortState>({ key: 'verifiedAt', direction: 'desc' })
  const [query, setQuery] = useState('')

  const [truncated, setTruncated] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // El año entero lo lee el servidor (sin el tope de 800 y guardado 5 minutos).
      const [fromSubcollection, yearData] = await Promise.all([
        getVerifiedConsumptionsByCompany(companyId),
        fetchYearReservationsForReports(companyId, config.year),
      ])

      setRecords(mergeVerifiedConsumptions(fromSubcollection, yearData.reservations))
      setTruncated(yearData.truncated)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [companyId, config.year])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const availableYears = useMemo(() => reportYearOptions(), [])

  const periodRecords = useMemo(
    () => filterVerifiedInRange(records, getReportDateRange(config)),
    [records, config],
  )

  const previousConfig = previousPeriodConfig(config)
  const previousKpis = useMemo(() => {
    if (!previousConfig) {
      return null
    }
    return computeProductKpis(filterVerifiedInRange(records, getReportDateRange(previousConfig)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, previousConfig?.granularity, previousConfig?.month, previousConfig?.quarter, previousConfig?.year])

  const kpis = useMemo(() => computeProductKpis(periodRecords), [periodRecords])
  const topProducts = useMemo(() => computeTopProducts(periodRecords, 8), [periodRecords])
  const allProducts = useMemo(() => computeTopProducts(periodRecords, 500), [periodRecords])
  const trendData = useMemo(() => computeProductTrendChartData(records, config), [records, config])
  const modeData = useMemo(() => computeModeDistribution(periodRecords), [periodRecords])
  const hourSlotData = useMemo(() => computeProductHourChartData(periodRecords), [periodRecords])

  const sortedProducts = useMemo(() => {
    const list = [...allProducts]
    list.sort((left, right) => {
      switch (productSort.key as ProductSortKey) {
        case 'name':
          return compareStrings(left.name, right.name, productSort.direction)
        case 'revenue':
          return compareNumbers(left.totalCents, right.totalCents, productSort.direction)
        case 'quantity':
        default:
          return compareNumbers(left.quantity, right.quantity, productSort.direction)
      }
    })
    return list
  }, [allProducts, productSort])

  const maxQuantity = Math.max(1, ...allProducts.map((product) => product.quantity))
  const rankByQuantity = useMemo(() => {
    const ranked = [...allProducts].sort((left, right) => right.quantity - left.quantity)
    return new Map(ranked.map((product, index) => [product.nodeId, index + 1]))
  }, [allProducts])

  const sortedVerifications = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const list = normalized
      ? periodRecords.filter((record) =>
        `${record.clientName} ${record.lineItems.map((item) => item.name).join(' ')}`.toLowerCase().includes(normalized))
      : [...periodRecords]

    list.sort((left, right) => {
      switch (verificationSort.key as VerificationSortKey) {
        case 'clientName':
          return compareStrings(left.clientName, right.clientName, verificationSort.direction)
        case 'startTime':
          return compareDates(left.reservationStartTime, right.reservationStartTime, verificationSort.direction)
        case 'totalCents':
          return compareNumbers(left.totalCents, right.totalCents, verificationSort.direction)
        case 'verifiedAt':
        default:
          return compareDates(left.verifiedAt, right.verifiedAt, verificationSort.direction)
      }
    })
    return list
  }, [periodRecords, verificationSort, query])

  const periodLabel = formatReportPeriodLabel(config)
  const prevLabel = previousPeriodLabel(config)
  const averageTicket = kpis.verificationCount > 0 ? Math.round(kpis.totalCents / kpis.verificationCount) : 0
  const prevAverageTicket = previousKpis && previousKpis.verificationCount > 0
    ? Math.round(previousKpis.totalCents / previousKpis.verificationCount)
    : null

  const onProductSort = (key: string) => setProductSort((current) =>
    nextSortState(current, key, PRODUCT_SORT_DEFAULTS[key as ProductSortKey] ?? 'asc'))
  const onVerificationSort = (key: string) => setVerificationSort((current) =>
    nextSortState(current, key, VERIFICATION_SORT_DEFAULTS[key as VerificationSortKey] ?? 'asc'))

  const handleDownloadProducts = () => {
    downloadExcelFile(
      `productos-${periodLabel.replaceAll(' ', '-')}.csv`,
      ['Producto', 'Unidades', 'Ingresos (€)'],
      sortedProducts.map((product) => [
        product.name,
        product.quantity,
        (product.totalCents / 100).toFixed(2).replace('.', ','),
      ]),
    )
  }

  const handleDownloadVerifications = () => {
    downloadExcelFile(
      `verificaciones-${periodLabel.replaceAll(' ', '-')}.csv`,
      ['Cliente', 'Fecha reserva', 'Hora', 'Modo', 'Total (€)', 'Productos', 'Verificado el'],
      sortedVerifications.map((record) => [
        record.clientName,
        formatExcelDate(record.reservationStartTime),
        formatTimeSpanish(record.reservationStartTime),
        record.mode === 'products' ? 'Por productos' : 'Importe total',
        (record.totalCents / 100).toFixed(2).replace('.', ','),
        record.lineItems.map((item) => `${item.quantity}× ${item.name}`).join('; ') || '—',
        formatExcelDateTime(record.verifiedAt),
      ]),
    )
  }

  return (
    <div className={styles.page}>
      <ReportHeader
        title="Informe de productos"
        subtitle="Lo que piden tus clientes cuando verifican el consumo con tu código en las promociones con gasto mínimo."
      />

      <ReportPeriodBar
        config={config}
        years={availableYears}
        periodLabel={periodLabel}
        loading={loading}
        onChange={setConfig}
        onRefresh={() => void loadData()}
      />

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {truncated ? (
        <div className={styles.error} role="status">
          Este año tiene más de 10.000 reservas y solo se cuentan las primeras. Escríbenos y lo
          ampliamos para tu local.
        </div>
      ) : null}

      {loading && records.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          <KpiGrid columns={4}>
            <KpiCard
              icon={Euro}
              label="Ingresos verificados"
              value={formatCentsAsEuros(kpis.totalCents)}
              delta={computeDelta(kpis.totalCents, previousKpis?.totalCents)}
              deltaLabel={prevLabel}
              hint={previousKpis ? `vs. ${prevLabel}` : undefined}
              tone="good"
            />
            <KpiCard
              icon={Package}
              label="Unidades"
              value={formatNumber(kpis.unitsSold)}
              delta={computeDelta(kpis.unitsSold, previousKpis?.unitsSold)}
              deltaLabel={prevLabel}
            />
            <KpiCard
              icon={BadgeCheck}
              label="Verificaciones"
              value={formatNumber(kpis.verificationCount)}
              delta={computeDelta(kpis.verificationCount, previousKpis?.verificationCount)}
              deltaLabel={prevLabel}
              tone="info"
            />
            <KpiCard
              icon={Receipt}
              label="Ticket medio"
              value={kpis.verificationCount ? formatCentsAsEuros(averageTicket) : '—'}
              delta={prevAverageTicket != null && kpis.verificationCount ? computeDelta(averageTicket, prevAverageTicket) : null}
              deltaLabel={prevLabel}
              hint="por verificación"
              tone="warn"
            />
          </KpiGrid>

          <ChartsGrid>
            <ReportCard wide icon={TrendingUp} title="Evolución" subtitle={`Ingresos y unidades · ${periodLabel}`}>
              <ProductRevenueTrendChart data={trendData} />
            </ReportCard>
            <ReportCard icon={Trophy} title="Más pedidos" subtitle="Top productos por unidades">
              <ProductTopBarChart products={topProducts} metric="quantity" />
            </ReportCard>
            <ReportCard icon={Euro} title="Más facturan" subtitle="Top productos por ingresos">
              <ProductTopBarChart products={topProducts} metric="revenue" />
            </ReportCard>
            <ReportCard icon={PieChart} title="Cómo se verifica" subtitle="Detalle por productos o solo el importe">
              <ProductModeDonut withProducts={modeData.withProducts} totalOnly={modeData.totalOnly} />
            </ReportCard>
            <ReportCard icon={Clock} title="Por hora de reserva" subtitle="En qué franjas se piden más productos">
              <ReservationHourSlotsChart data={hourSlotData} />
            </ReportCard>
          </ChartsGrid>

          <TableCard
            title="Ranking de productos"
            meta={`${sortedProducts.length} ${sortedProducts.length === 1 ? 'producto' : 'productos'} · ${periodLabel}`}
            onDownload={handleDownloadProducts}
            downloadDisabled={sortedProducts.length === 0}
          >
            {sortedProducts.length === 0 ? (
              <EmptyState
                icon={ShoppingBasket}
                title="Sin productos verificados en este periodo"
                text="Aparecen cuando un cliente verifica el consumo con tu código en una promoción con gasto mínimo."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '3rem' }}>#</th>
                      <SortableTh label="Producto" sortKey="name" sort={productSort} onSort={onProductSort} />
                      <SortableTh label="Unidades" sortKey="quantity" sort={productSort} onSort={onProductSort} />
                      <th scope="col" style={{ width: '30%' }}>Peso</th>
                      <SortableTh label="Ingresos" sortKey="revenue" sort={productSort} onSort={onProductSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((product) => {
                      const rank = rankByQuantity.get(product.nodeId) ?? 0
                      return (
                        <tr key={product.nodeId}>
                          <td>
                            <span className={`${styles.rank} ${rank <= 3 ? styles.rankTop : ''}`}>{rank}</span>
                          </td>
                          <td><strong>{product.name}</strong></td>
                          <td>{formatNumber(product.quantity)}</td>
                          <td><InlineBar value={product.quantity} max={maxQuantity} /></td>
                          <td className={styles.nowrap}>{formatCentsAsEuros(product.totalCents)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TableCard>

          <TableCard
            title="Verificaciones de consumo"
            meta={`Cada reserva con consumo validado con tu código · ${periodLabel}`}
            search={{ value: query, onChange: setQuery, placeholder: 'Buscar cliente o producto' }}
            onDownload={handleDownloadVerifications}
            downloadDisabled={sortedVerifications.length === 0}
          >
            {sortedVerifications.length === 0 ? (
              <EmptyState
                icon={BadgeCheck}
                title={query.trim() ? 'Ninguna verificación coincide' : 'Sin verificaciones en este periodo'}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh label="Cliente" sortKey="clientName" sort={verificationSort} onSort={onVerificationSort} />
                      <SortableTh label="Reserva" sortKey="startTime" sort={verificationSort} onSort={onVerificationSort} />
                      <th scope="col">Modo</th>
                      <th scope="col">Productos</th>
                      <SortableTh label="Total" sortKey="totalCents" sort={verificationSort} onSort={onVerificationSort} />
                      <SortableTh label="Verificado" sortKey="verifiedAt" sort={verificationSort} onSort={onVerificationSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVerifications.map((record) => (
                      <tr key={record.id}>
                        <td><strong>{record.clientName || '—'}</strong></td>
                        <td className={styles.nowrap}>
                          {formatDateSpanish(record.reservationStartTime)} · {formatTimeSpanish(record.reservationStartTime)}
                        </td>
                        <td>
                          <span className={`${styles.chip} ${record.mode === 'products' ? styles.chipOk : styles.chipInfo}`}>
                            {record.mode === 'products' ? 'Por productos' : 'Importe total'}
                          </span>
                        </td>
                        <td>
                          {record.lineItems.length > 0 ? (
                            <span className={styles.tagList}>
                              {record.lineItems.map((item) => (
                                <span key={`${record.id}-${item.nodeId}`} className={styles.tag}>
                                  {item.quantity}× {item.name}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className={styles.muted}>—</span>
                          )}
                        </td>
                        <td className={styles.nowrap}><strong>{formatCentsAsEuros(record.totalCents)}</strong></td>
                        <td className={`${styles.nowrap} ${styles.muted}`}>{formatDateSpanish(record.verifiedAt)}</td>
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

export default CompanyReportsProducts
