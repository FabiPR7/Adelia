import { useCallback, useEffect, useMemo, useState } from 'react'
import ReservationWeekdayChart from '../../components/reports/ReservationWeekdayChart'
import SortableTh from '../../components/reports/SortableTh'
import { getCompanyReviews } from '../../services/companyReviews'
import { getFirestoreErrorMessage } from '../../services/firestore'
import type { CompanyReview } from '../../types/review'
import { downloadExcelFile, formatExcelDate } from '../../utils/exportSpreadsheet'
import {
  compareDates,
  compareNumbers,
  compareStrings,
  nextSortState,
  type SortState,
} from '../../utils/tableSort'
import {
  computeRatingDistribution,
  computeReviewKpis,
  computeReviewTrend,
  filterReviewsInRange,
  formatReportPeriodLabel,
  getReportDateRange,
  getReviewReportYears,
  type ReportGranularity,
  type ReportPeriodConfig,
} from '../../utils/reviewReports'
import styles from './CompanyReportsReservations.module.css'

type ReviewSortKey = 'date' | 'rating' | 'adelinas' | 'name'

const SORT_DEFAULTS: Record<ReviewSortKey, SortState['direction']> = {
  date: 'desc',
  rating: 'desc',
  adelinas: 'desc',
  name: 'asc',
}

interface CompanyReportsReviewsProps {
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

function CompanyReportsReviews({ companyId }: CompanyReportsReviewsProps) {
  const now = new Date()
  const [granularity, setGranularity] = useState<ReportGranularity>('monthly')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [reviews, setReviews] = useState<CompanyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'date', direction: 'desc' })

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReviews(await getCompanyReviews(companyId))
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const availableYears = useMemo(() => {
    const years = getReviewReportYears(reviews)
    return years.length > 0 ? years : [now.getFullYear()]
  }, [reviews])

  useEffect(() => {
    if (!availableYears.includes(year)) {
      setYear(availableYears[0])
    }
  }, [availableYears, year])

  const periodConfig = useMemo<ReportPeriodConfig>(
    () => ({ granularity, year, month, quarter }),
    [granularity, month, quarter, year],
  )
  const periodReviews = useMemo(() => {
    const range = getReportDateRange(periodConfig)
    return filterReviewsInRange(reviews, range)
  }, [periodConfig, reviews])
  const periodLabel = formatReportPeriodLabel(periodConfig)
  const kpis = useMemo(() => computeReviewKpis(periodReviews), [periodReviews])
  const ratingData = useMemo(() => computeRatingDistribution(periodReviews), [periodReviews])
  const trend = useMemo(() => computeReviewTrend(periodReviews, periodConfig), [periodConfig, periodReviews])
  const trendChart = useMemo(() => ({
    labels: trend.labels,
    values: trend.reviews,
    max: Math.max(1, ...trend.reviews),
  }), [trend])
  const adelinasChart = useMemo(() => ({
    labels: trend.labels,
    values: trend.adelinas,
    max: Math.max(1, ...trend.adelinas),
  }), [trend])

  const sortedReviews = useMemo(() => {
    const list = [...periodReviews]
    list.sort((left, right) => {
      switch (sort.key as ReviewSortKey) {
        case 'rating':
          return compareNumbers(left.rating, right.rating, sort.direction)
        case 'adelinas':
          return compareNumbers(left.adelinasEarned, right.adelinasEarned, sort.direction)
        case 'name':
          return compareStrings(left.customerName, right.customerName, sort.direction)
        case 'date':
        default:
          return compareDates(left.createdAt, right.createdAt, sort.direction)
      }
    })
    return list
  }, [periodReviews, sort])

  const handleSort = (key: string) => {
    setSort((current) => nextSortState(current, key, SORT_DEFAULTS[key as ReviewSortKey]))
  }

  const handleDownload = () => {
    downloadExcelFile(
      `reseñas-${periodLabel.replaceAll(' ', '-')}`,
      ['Fecha', 'Cliente', 'Estrellas', 'Adelinas', 'Foto', 'Respuesta'],
      sortedReviews.map((review) => [
        formatExcelDate(review.createdAt),
        review.customerName,
        review.rating,
        review.adelinasEarned,
        review.hasPhoto ? 'Sí' : 'No',
        review.ownerReply?.text ? 'Sí' : 'No',
      ]),
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.scrollArea}>
        <header className={styles.header}>
          <h2>Informe de reseñas</h2>
          <p>Puntuación, Adelinas, fotos y respuestas de los comensales.</p>
        </header>

        <div className={styles.controls}>
          <div className={styles.controlsFilters}>
            <div className={styles.periodToggle}>
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={granularity === option.id ? styles.periodButtonActive : styles.periodButton}
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
              {availableYears.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            {granularity === 'monthly' ? (
              <select
                className={styles.select}
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                aria-label="Mes"
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : null}
            {granularity === 'quarterly' ? (
              <select
                className={styles.select}
                value={quarter}
                onChange={(event) => setQuarter(Number(event.target.value))}
                aria-label="Trimestre"
              >
                {QUARTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : null}
          </div>

          <div className={styles.controlsSummary}>
            <button type="button" className={styles.refreshButton} onClick={() => void loadReviews()} disabled={loading}>
              {loading ? 'Actualizando…' : 'Actualizar'}
            </button>
            {!loading || reviews.length > 0 ? (
              <div className={styles.kpiInline} aria-label="Resumen del periodo">
                <span className={`${styles.kpiChip} ${styles.kpiChipTotal}`}>
                  <span className={styles.kpiLabel}>Reseñas</span>
                  <strong className={styles.kpiValue}>{kpis.total}</strong>
                </span>
                <span className={`${styles.kpiChip} ${styles.kpiChipConfirmed}`}>
                  <span className={styles.kpiLabel}>Media</span>
                  <strong className={styles.kpiValue}>
                    {kpis.average.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </strong>
                </span>
                <span className={styles.kpiChip}>
                  <span className={styles.kpiLabel}>Adelinas</span>
                  <strong className={styles.kpiValue}>{kpis.adelinas}</strong>
                </span>
                <span className={styles.kpiChip}>
                  <span className={styles.kpiLabel}>Respuestas</span>
                  <strong className={styles.kpiValue}>{Math.round(kpis.replyRate * 100)}%</strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        {loading && reviews.length === 0 ? (
          <div className={styles.loading}>Cargando reseñas…</div>
        ) : (
          <>
            <div className={styles.chartsGrid}>
              <section className={`${styles.chartCard} ${styles.chartCardWide}`}>
                <div className={styles.chartHeader}>
                  <h3>Reseñas del periodo</h3>
                  <p className={styles.chartSubtitle}>Volumen publicado · {periodLabel}</p>
                </div>
                <ReservationWeekdayChart data={trendChart} emptyLabel="Sin reseñas en este periodo" />
              </section>
              <section className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3>Estrellas</h3>
                  <p className={styles.chartSubtitle}>Distribución de 1 a 5</p>
                </div>
                <ReservationWeekdayChart data={ratingData} emptyLabel="Sin reseñas en este periodo" />
              </section>
              <section className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3>Adelinas ganadas</h3>
                  <p className={styles.chartSubtitle}>Suma de Adelinas por reseña · {periodLabel}</p>
                </div>
                <ReservationWeekdayChart data={adelinasChart} emptyLabel="Sin Adelinas en este periodo" />
              </section>
            </div>

            <section className={styles.listSection}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderText}>
                  <h3>Listado de reseñas</h3>
                  <p className={styles.listMeta}>{sortedReviews.length} en {periodLabel} · {kpis.withPhoto} con foto</p>
                </div>
                <button type="button" className={styles.downloadButton} onClick={handleDownload}>
                  Descargar Excel
                </button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh label="Fecha" sortKey="date" sort={sort} onSort={handleSort} />
                      <SortableTh label="Cliente" sortKey="name" sort={sort} onSort={handleSort} />
                      <SortableTh label="Estrellas" sortKey="rating" sort={sort} onSort={handleSort} />
                      <SortableTh label="Adelinas" sortKey="adelinas" sort={sort} onSort={handleSort} />
                      <th>Foto</th>
                      <th>Respuesta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviews.length === 0 ? (
                      <tr>
                        <td colSpan={6}>No hay reseñas en este periodo.</td>
                      </tr>
                    ) : sortedReviews.map((review) => (
                      <tr key={review.id}>
                        <td>{review.createdAt.toLocaleDateString('es-ES')}</td>
                        <td>{review.customerName || 'Cliente'}</td>
                        <td>{review.rating}</td>
                        <td>{review.adelinasEarned}</td>
                        <td>{review.hasPhoto ? 'Sí' : 'No'}</td>
                        <td>{review.ownerReply?.text ? 'Sí' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default CompanyReportsReviews
