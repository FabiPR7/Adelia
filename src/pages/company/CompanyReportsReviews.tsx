import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Coins, MessageSquareReply, MessageSquareText, Star, TrendingUp } from 'lucide-react'
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
import { getCompanyReviews } from '../../services/companyReviews'
import { getFirestoreErrorMessage } from '../../services/firestore'
import type { CompanyReview } from '../../types/review'
import { cleanReviewExcerpt } from '../../utils/reviewCommentTags'
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
  type ReportPeriodConfig,
} from '../../utils/reviewReports'

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

function ratingChip(rating: number): string {
  if (rating >= 4) return styles.chipOk
  if (rating === 3) return styles.chipWarn
  return styles.chipBad
}

function CompanyReportsReviews({ companyId }: CompanyReportsReviewsProps) {
  const now = new Date()
  const [config, setConfig] = useState<ReportPeriodConfig>({
    granularity: 'monthly',
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    quarter: Math.floor(now.getMonth() / 3) + 1,
  })
  const [reviews, setReviews] = useState<CompanyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortState>({ key: 'date', direction: 'desc' })
  const [query, setQuery] = useState('')

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
    return years.length > 0 ? years : [new Date().getFullYear()]
  }, [reviews])

  useEffect(() => {
    if (!availableYears.includes(config.year)) {
      setConfig((current) => ({ ...current, year: availableYears[0] }))
    }
  }, [availableYears, config.year])

  const periodReviews = useMemo(
    () => filterReviewsInRange(reviews, getReportDateRange(config)),
    [config, reviews],
  )

  // Aquí se cargan todas las reseñas, así que también se puede comparar con el año anterior.
  const previousConfig = config.granularity === 'annual'
    ? { ...config, year: config.year - 1 }
    : previousPeriodConfig(config)
  const previousKpis = useMemo(() => {
    if (!previousConfig) {
      return null
    }
    return computeReviewKpis(filterReviewsInRange(reviews, getReportDateRange(previousConfig)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, previousConfig?.granularity, previousConfig?.month, previousConfig?.quarter, previousConfig?.year])

  const periodLabel = formatReportPeriodLabel(config)
  const prevLabel = previousPeriodLabel(config)
  const kpis = useMemo(() => computeReviewKpis(periodReviews), [periodReviews])
  const ratingData = useMemo(() => computeRatingDistribution(periodReviews), [periodReviews])
  const trend = useMemo(() => computeReviewTrend(periodReviews, config), [config, periodReviews])
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
    const normalized = query.trim().toLowerCase()
    const list = normalized
      ? periodReviews.filter((review) =>
        `${review.customerName} ${cleanReviewExcerpt(review.comment)}`.toLowerCase().includes(normalized))
      : [...periodReviews]
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
  }, [periodReviews, sort, query])

  const handleSort = (key: string) => {
    setSort((current) => nextSortState(current, key, SORT_DEFAULTS[key as ReviewSortKey]))
  }

  const handleDownload = () => {
    downloadExcelFile(
      `resenas-${periodLabel.replaceAll(' ', '-')}.csv`,
      ['Fecha', 'Cliente', 'Estrellas', 'Comentario', 'Adelinas', 'Foto', 'Respuesta'],
      sortedReviews.map((review) => [
        formatExcelDate(review.createdAt),
        review.customerName,
        review.rating,
        cleanReviewExcerpt(review.comment),
        review.adelinasEarned,
        review.hasPhoto ? 'Sí' : 'No',
        review.ownerReply?.text ? 'Sí' : 'No',
      ]),
    )
  }

  const replyPercent = Math.round(kpis.replyRate * 100)
  const prevReplyPercent = previousKpis && previousKpis.total > 0 ? Math.round(previousKpis.replyRate * 100) : null

  return (
    <div className={styles.page}>
      <ReportHeader
        title="Informe de reseñas"
        subtitle="Cómo te puntúan tus clientes, cuántas reseñas respondes y las Adelinas que ganan al opinar."
      />

      <ReportPeriodBar
        config={config}
        years={availableYears}
        periodLabel={periodLabel}
        loading={loading}
        onChange={setConfig}
        onRefresh={() => void loadReviews()}
      />

      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      {loading && reviews.length === 0 ? (
        <LoadingState />
      ) : (
        <>
          <KpiGrid columns={5}>
            <KpiCard
              icon={MessageSquareText}
              label="Reseñas"
              value={formatNumber(kpis.total)}
              delta={computeDelta(kpis.total, previousKpis?.total)}
              deltaLabel={prevLabel}
              tone="info"
            />
            <KpiCard
              icon={Star}
              label="Puntuación media"
              value={kpis.total ? formatNumber(kpis.average, 1) : '—'}
              suffix="/ 5"
              delta={previousKpis && previousKpis.total > 0 && kpis.total > 0
                ? computeDelta(Math.round(kpis.average * 10), Math.round(previousKpis.average * 10))
                : null}
              deltaLabel={prevLabel}
              tone="warn"
            />
            <KpiCard
              icon={MessageSquareReply}
              label="Respondidas"
              value={replyPercent}
              suffix="%"
              delta={prevReplyPercent != null ? computeDelta(replyPercent, prevReplyPercent) : null}
              deltaLabel={prevLabel}
              hint={`${kpis.withReply} de ${kpis.total}`}
              tone="good"
            />
            <KpiCard
              icon={Camera}
              label="Con foto"
              value={formatNumber(kpis.withPhoto)}
              hint={kpis.total ? `${Math.round((kpis.withPhoto / kpis.total) * 100)} % del total` : undefined}
            />
            <KpiCard
              icon={Coins}
              label="Adelinas repartidas"
              value={formatNumber(kpis.adelinas)}
              delta={computeDelta(kpis.adelinas, previousKpis?.adelinas)}
              deltaLabel={prevLabel}
            />
          </KpiGrid>

          <ChartsGrid>
            <ReportCard wide icon={TrendingUp} title="Reseñas publicadas" subtitle={`Volumen a lo largo del periodo · ${periodLabel}`}>
              <ReservationWeekdayChart data={trendChart} emptyLabel="Sin reseñas en este periodo" />
            </ReportCard>
            <ReportCard icon={Star} title="Estrellas" subtitle="Reparto de 1 a 5">
              <ReservationWeekdayChart data={ratingData} emptyLabel="Sin reseñas en este periodo" />
            </ReportCard>
            <ReportCard icon={Coins} title="Adelinas ganadas" subtitle="Suma de Adelinas por reseña">
              <ReservationWeekdayChart data={adelinasChart} emptyLabel="Sin Adelinas en este periodo" />
            </ReportCard>
          </ChartsGrid>

          <TableCard
            title="Reseñas del periodo"
            meta={`${sortedReviews.length} ${sortedReviews.length === 1 ? 'reseña' : 'reseñas'} · ${periodLabel}`}
            search={{ value: query, onChange: setQuery, placeholder: 'Buscar cliente o texto' }}
            onDownload={handleDownload}
            downloadDisabled={sortedReviews.length === 0}
          >
            {sortedReviews.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                title={query.trim() ? 'Ninguna reseña coincide' : 'Sin reseñas en este periodo'}
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <SortableTh label="Fecha" sortKey="date" sort={sort} onSort={handleSort} />
                      <SortableTh label="Cliente" sortKey="name" sort={sort} onSort={handleSort} />
                      <SortableTh label="Nota" sortKey="rating" sort={sort} onSort={handleSort} />
                      <th scope="col">Comentario</th>
                      <SortableTh label="Adelinas" sortKey="adelinas" sort={sort} onSort={handleSort} />
                      <th scope="col">Foto</th>
                      <th scope="col">Respuesta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedReviews.map((review) => {
                      const excerpt = cleanReviewExcerpt(review.comment)
                      return (
                        <tr key={review.id}>
                          <td className={`${styles.nowrap} ${styles.muted}`}>
                            {review.createdAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td><strong>{review.customerName || 'Cliente'}</strong></td>
                          <td>
                            <span className={`${styles.chip} ${ratingChip(review.rating)}`}>★ {review.rating}</span>
                          </td>
                          <td className={styles.muted} style={{ maxWidth: '22rem' }} title={excerpt}>
                            {excerpt ? (excerpt.length > 80 ? `${excerpt.slice(0, 80)}…` : excerpt) : '—'}
                          </td>
                          <td>{review.adelinasEarned}</td>
                          <td>
                            {review.hasPhoto
                              ? <span className={`${styles.chip} ${styles.chipInfo}`}>Sí</span>
                              : <span className={styles.muted}>—</span>}
                          </td>
                          <td>
                            {review.ownerReply?.text
                              ? <span className={`${styles.chip} ${styles.chipOk}`}>Respondida</span>
                              : <span className={`${styles.chip} ${styles.chipWarn}`}>Pendiente</span>}
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

export default CompanyReportsReviews
