import { useCallback, useEffect, useMemo, useState } from 'react'
import ProductModeDonut from '../../components/reports/ProductModeDonut'
import ProductRevenueTrendChart from '../../components/reports/ProductRevenueTrendChart'
import ProductTopBarChart from '../../components/reports/ProductTopBarChart'
import ReservationHourSlotsChart from '../../components/reports/ReservationHourSlotsChart'
import SortableTh from '../../components/reports/SortableTh'
import {
  getFirestoreErrorMessage,
  getReservationsByCompany,
  getVerifiedConsumptionsByCompany,
} from '../../services/firestore'
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
  getAvailableYearsFromVerified,
  getReportDateRange,
  mergeVerifiedConsumptions,
} from '../../utils/productReports'
import type { ReportGranularity, ReportPeriodConfig } from '../../utils/reservationReports'
import styles from './CompanyReportsReservations.module.css'

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

function CompanyReportsProducts({ companyId }: CompanyReportsProductsProps) {
  const now = new Date()
  const [granularity, setGranularity] = useState<ReportGranularity>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [records, setRecords] = useState<VerifiedConsumptionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productSort, setProductSort] = useState<SortState>({ key: 'quantity', direction: 'desc' })
  const [verificationSort, setVerificationSort] = useState<SortState>({
    key: 'verifiedAt',
    direction: 'desc',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [fromSubcollection, reservations] = await Promise.all([
        getVerifiedConsumptionsByCompany(companyId),
        getReservationsByCompany(companyId),
      ])

      setRecords(mergeVerifiedConsumptions(fromSubcollection, reservations))
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const availableYears = useMemo(() => getAvailableYearsFromVerified(records), [records])

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year)) {
      setYear(availableYears[0])
    }
  }, [availableYears, year])

  const periodConfig = useMemo<ReportPeriodConfig>(
    () => ({ granularity, year, month, quarter }),
    [granularity, year, month, quarter],
  )

  const periodRecords = useMemo(() => {
    const range = getReportDateRange(periodConfig)
    return filterVerifiedInRange(records, range)
  }, [records, periodConfig])

  const kpis = useMemo(() => computeProductKpis(periodRecords), [periodRecords])
  const topProducts = useMemo(() => computeTopProducts(periodRecords, 8), [periodRecords])
  const trendData = useMemo(
    () => computeProductTrendChartData(records, periodConfig),
    [records, periodConfig],
  )
  const modeData = useMemo(() => computeModeDistribution(periodRecords), [periodRecords])
  const hourSlotData = useMemo(
    () => computeProductHourChartData(periodRecords),
    [periodRecords],
  )

  const sortedProducts = useMemo(() => {
    const list = [...topProducts]

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
  }, [topProducts, productSort])

  const sortedVerifications = useMemo(() => {
    const list = [...periodRecords]

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
  }, [periodRecords, verificationSort])

  const periodLabel = formatReportPeriodLabel(periodConfig)

  const handleDownloadProducts = () => {
    downloadExcelFile(
      'productos-verificados-adelia.csv',
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
      'verificaciones-consumo-adelia.csv',
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
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h2>Informes de productos</h2>
        <p>
          Consumo verificado en promociones con gasto mínimo: qué pidieron los clientes y cuánto
          generó cada producto.
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
              onClick={() => void loadData()}
              disabled={loading}
            >
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>

            {!loading || records.length > 0 ? (
              <div className={styles.kpiInline} aria-label="Resumen del periodo">
                <span className={`${styles.kpiChip} ${styles.kpiChipTotal}`}>
                  <span className={styles.kpiLabel}>Verificaciones</span>
                  <strong className={styles.kpiValue}>{kpis.verificationCount}</strong>
                </span>
                <span className={`${styles.kpiChip} ${styles.kpiChipConfirmed}`}>
                  <span className={styles.kpiLabel}>Ingresos</span>
                  <strong className={styles.kpiValue}>{formatCentsAsEuros(kpis.totalCents)}</strong>
                </span>
                <span className={`${styles.kpiChip} ${styles.kpiChipCancelled}`}>
                  <span className={styles.kpiLabel}>Unidades</span>
                  <strong className={styles.kpiValue}>{kpis.unitsSold}</strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading && records.length === 0 ? (
          <div className={styles.loading}>Cargando informes…</div>
        ) : (
          <>
            <div className={styles.chartsGrid}>
              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Tendencia del periodo</h3>
                  <p className={styles.chartSubtitle}>
                    Ingresos verificados y unidades vendidas · {periodLabel}
                  </p>
                </div>
                <ProductRevenueTrendChart data={trendData} />
              </section>

              <section className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3>Modo de verificación</h3>
                  <p className={styles.chartSubtitle}>Detalle por productos vs importe total declarado</p>
                </div>
                <ProductModeDonut
                  withProducts={modeData.withProducts}
                  totalOnly={modeData.totalOnly}
                />
              </section>

              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Top productos por unidades</h3>
                  <p className={styles.chartSubtitle}>Los más elegidos al verificar el consumo</p>
                </div>
                <ProductTopBarChart products={topProducts} metric="quantity" />
              </section>

              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Top productos por ingresos</h3>
                  <p className={styles.chartSubtitle}>Facturación acumulada en verificaciones</p>
                </div>
                <ProductTopBarChart products={topProducts} metric="revenue" />
              </section>

              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Unidades por hora de reserva</h3>
                  <p className={styles.chartSubtitle}>
                    En qué franjas se concentran los productos verificados · {periodLabel}
                  </p>
                </div>
                <ReservationHourSlotsChart data={hourSlotData} />
              </section>
            </div>

            <section className={styles.listSection}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderText}>
                  <h3>Ranking de productos</h3>
                  <p className={styles.listMeta}>{periodLabel}</p>
                </div>
                <button
                  type="button"
                  className={styles.downloadButton}
                  onClick={handleDownloadProducts}
                  disabled={sortedProducts.length === 0}
                >
                  Descargar Excel
                </button>
              </div>

              {sortedProducts.length === 0 ? (
                <div className={styles.emptyList}>No hay productos verificados en este periodo.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <SortableTh
                          label="Producto"
                          sortKey="name"
                          sort={productSort}
                          onSort={(key) => setProductSort((current) => nextSortState(
                            current,
                            key,
                            PRODUCT_SORT_DEFAULTS[key as ProductSortKey] ?? 'asc',
                          ))}
                        />
                        <SortableTh
                          label="Unidades"
                          sortKey="quantity"
                          sort={productSort}
                          onSort={(key) => setProductSort((current) => nextSortState(
                            current,
                            key,
                            PRODUCT_SORT_DEFAULTS[key as ProductSortKey] ?? 'asc',
                          ))}
                        />
                        <SortableTh
                          label="Ingresos"
                          sortKey="revenue"
                          sort={productSort}
                          onSort={(key) => setProductSort((current) => nextSortState(
                            current,
                            key,
                            PRODUCT_SORT_DEFAULTS[key as ProductSortKey] ?? 'asc',
                          ))}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedProducts.map((product) => (
                        <tr key={product.nodeId}>
                          <td>{product.name}</td>
                          <td>{product.quantity}</td>
                          <td>{formatCentsAsEuros(product.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.listSection}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderText}>
                  <h3>Detalle de verificaciones</h3>
                  <p className={styles.listMeta}>
                    Cada reserva con consumo validado por PIN · {periodLabel}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.downloadButton}
                  onClick={handleDownloadVerifications}
                  disabled={sortedVerifications.length === 0}
                >
                  Descargar Excel
                </button>
              </div>

              {sortedVerifications.length === 0 ? (
                <div className={styles.emptyList}>No hay verificaciones de consumo en este periodo.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <SortableTh
                          label="Cliente"
                          sortKey="clientName"
                          sort={verificationSort}
                          onSort={(key) => setVerificationSort((current) => nextSortState(
                            current,
                            key,
                            VERIFICATION_SORT_DEFAULTS[key as VerificationSortKey] ?? 'asc',
                          ))}
                        />
                        <SortableTh
                          label="Fecha reserva"
                          sortKey="startTime"
                          sort={verificationSort}
                          onSort={(key) => setVerificationSort((current) => nextSortState(
                            current,
                            key,
                            VERIFICATION_SORT_DEFAULTS[key as VerificationSortKey] ?? 'asc',
                          ))}
                        />
                        <th scope="col">Modo</th>
                        <SortableTh
                          label="Total"
                          sortKey="totalCents"
                          sort={verificationSort}
                          onSort={(key) => setVerificationSort((current) => nextSortState(
                            current,
                            key,
                            VERIFICATION_SORT_DEFAULTS[key as VerificationSortKey] ?? 'asc',
                          ))}
                        />
                        <th scope="col">Productos</th>
                        <SortableTh
                          label="Verificado"
                          sortKey="verifiedAt"
                          sort={verificationSort}
                          onSort={(key) => setVerificationSort((current) => nextSortState(
                            current,
                            key,
                            VERIFICATION_SORT_DEFAULTS[key as VerificationSortKey] ?? 'asc',
                          ))}
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedVerifications.map((record) => (
                        <tr key={record.id}>
                          <td>{record.clientName || '—'}</td>
                          <td>
                            {formatDateSpanish(record.reservationStartTime)}
                            {' · '}
                            {formatTimeSpanish(record.reservationStartTime)}
                          </td>
                          <td>
                            {record.mode === 'products' ? 'Por productos' : 'Importe total'}
                          </td>
                          <td>{formatCentsAsEuros(record.totalCents)}</td>
                          <td className={styles.productsCell}>
                            {record.lineItems.length > 0
                              ? record.lineItems.map((item) => (
                                <span key={`${record.id}-${item.nodeId}`} className={styles.productTag}>
                                  {item.quantity}× {item.name}
                                </span>
                              ))
                              : '—'}
                          </td>
                          <td>{formatDateSpanish(record.verifiedAt)}</td>
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

export default CompanyReportsProducts
