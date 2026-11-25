import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getReservationsByCompany, getTablesByCompany } from '../../services/firestore'
import { getCompanyPromotions } from '../../services/promotions'
import { getCompanyReviews } from '../../services/companyReviews'
import type { CompanyTab, Reservation, RestaurantTable } from '../../types'
import type { CompanyPromotion } from '../../types/company'
import type { CompanyReview } from '../../types/review'
import { cleanReviewExcerpt } from '../../utils/reviewCommentTags'
import styles from './CompanyHome.module.css'
import { formatNumber } from '../../utils/formatNumber'

interface CompanyHomeProps {
  companyId: string
  onOpenTab: (tab: CompanyTab) => void
}

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 14) return 'Buenos días'
  if (hour < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

function delta(current: number, previous: number, unit: string): { text: string; tone: 'up' | 'down' | 'flat' } {
  const diff = current - previous
  if (diff === 0) return { text: `Igual que el mismo día de la semana pasada`, tone: 'flat' }
  const sign = diff > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(diff)} ${unit} frente a la semana pasada`,
    tone: diff > 0 ? 'up' : 'down',
  }
}

type RowStatus = { label: string; tone: 'ok' | 'info' | 'warn' | 'muted' | 'danger' }

function rowStatus(reservation: Reservation, now: Date): RowStatus {
  if (reservation.status === 'cancelled') {
    return reservation.noShow ? { label: 'No vino', tone: 'danger' } : { label: 'Cancelada', tone: 'muted' }
  }
  if (reservation.status === 'confirmed') return { label: 'Asistió', tone: 'ok' }
  return reservation.startTime.getTime() <= now.getTime()
    ? { label: 'Por marcar', tone: 'warn' }
    : { label: 'Reservada', tone: 'info' }
}

/** Portada del panel: el servicio de hoy, cómo va la semana y lo que necesita atención. */
function CompanyHome({ companyId, onOpenTab }: CompanyHomeProps) {
  const { company } = useAuth()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [promotions, setPromotions] = useState<CompanyPromotion[]>([])
  const [reviews, setReviews] = useState<CompanyReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    const today = startOfDay(new Date())
    const from = new Date(today.getTime() - 13 * DAY_MS)
    const to = new Date(today.getTime() + 8 * DAY_MS)
    setLoading(true)
    void Promise.all([
      getReservationsByCompany(companyId, { from, to }),
      getTablesByCompany(companyId).catch(() => [] as RestaurantTable[]),
      getCompanyPromotions(companyId).catch(() => [] as CompanyPromotion[]),
      getCompanyReviews(companyId).catch(() => [] as CompanyReview[]),
    ])
      .then(([reservationRows, tableRows, promotionRows, reviewRows]) => {
        if (cancelled) return
        setReservations(reservationRows)
        setTables(tableRows)
        setPromotions(promotionRows)
        setReviews(reviewRows)
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los datos. Recarga la página.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const data = useMemo(() => {
    const today = startOfDay(now)
    const lastWeekSameDay = new Date(today.getTime() - 7 * DAY_MS)
    const active = (row: Reservation) => row.status !== 'cancelled'

    const todayRows = reservations
      .filter((row) => sameDay(row.startTime, today))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    const todayActive = todayRows.filter(active)
    const lastWeekRows = reservations.filter((row) => sameDay(row.startTime, lastWeekSameDay) && active(row))

    const guestsToday = todayActive.reduce((sum, row) => sum + (row.pax || 0), 0)
    const guestsLastWeek = lastWeekRows.reduce((sum, row) => sum + (row.pax || 0), 0)
    const tablesUsedToday = new Set(todayActive.map((row) => row.tableId)).size

    const weekAgo = new Date(today.getTime() - 6 * DAY_MS)
    const pastWeek = reservations.filter((row) => row.startTime >= weekAgo && row.startTime < new Date(today.getTime() + DAY_MS))
    const noShows = pastWeek.filter((row) => row.noShow === true).length

    const pendingAttendance = todayRows.filter(
      (row) => row.status === 'completed' && row.startTime.getTime() <= now.getTime(),
    )

    // Semana de lunes a domingo (la actual).
    const monday = new Date(today.getTime() - (((today.getDay() + 6) % 7) * DAY_MS))
    const week = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, index) => {
      const day = new Date(monday.getTime() + index * DAY_MS)
      return {
        label,
        isToday: sameDay(day, today),
        count: reservations.filter((row) => sameDay(row.startTime, day) && active(row)).length,
      }
    })
    const weekMax = Math.max(1, ...week.map((day) => day.count))
    const weekTotal = week.reduce((sum, day) => sum + day.count, 0)

    const activePromotions = promotions
      .filter((promo) => promo.active)
      .map((promo) => ({
        id: promo.id,
        title: promo.title,
        used: promo.currentRedemptions ?? 0,
        max: promo.maxRedemptions,
      }))

    const unanswered = reviews.filter((review) => !review.ownerReply)
    const average = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null

    const attention: Array<{ id: string; title: string; body: string; tone: 'danger' | 'warn' | 'info'; tab: CompanyTab }> = []
    if (pendingAttendance.length > 0) {
      attention.push({
        id: 'attendance',
        title: `${pendingAttendance.length} ${pendingAttendance.length === 1 ? 'asistencia' : 'asistencias'} por marcar`,
        body: 'Marca quién vino para que sus premios y misiones cuenten.',
        tone: 'danger',
        tab: 'reservations',
      })
    }
    if (tables.length === 0) {
      attention.push({
        id: 'tables',
        title: 'Aún no tienes mesas',
        body: 'Tus clientes no pueden reservar hasta que añadas mesas.',
        tone: 'danger',
        tab: 'tables',
      })
    }
    if (unanswered.length > 0) {
      attention.push({
        id: 'reviews',
        title: `${unanswered.length} ${unanswered.length === 1 ? 'reseña sin responder' : 'reseñas sin responder'}`,
        body: 'Responder mejora tu valoración y la confianza de nuevos clientes.',
        tone: 'warn',
        tab: 'clients-reviews',
      })
    }
    for (const promo of activePromotions) {
      if (promo.max && promo.used / promo.max >= 0.8) {
        attention.push({
          id: `promo-${promo.id}`,
          title: `«${promo.title}» casi agotada`,
          body: `${promo.used} de ${promo.max} plazas usadas.`,
          tone: 'info',
          tab: 'clients-promotions',
        })
      }
    }

    const activity = [
      ...reservations.map((row) => ({
        id: `r-${row.id}`,
        at: row.createdAt,
        text: `${row.clientName || 'Un cliente'} reservó para ${row.pax} · ${row.startTime.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} a las ${timeLabel(row.startTime)}`,
      })),
      ...reviews.map((review) => ({
        id: `v-${review.id}`,
        at: review.createdAt,
        text: `Nueva reseña de ${review.customerName || 'un cliente'} · ${review.rating} ★`,
      })),
    ]
      .filter((item) => item.at instanceof Date && !Number.isNaN(item.at.getTime()))
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 6)

    return {
      todayRows,
      todayActive,
      guestsToday,
      tablesUsedToday,
      noShows,
      pastWeekCount: pastWeek.length,
      pendingAttendance,
      reservationsDelta: delta(todayActive.length, lastWeekRows.length, 'reservas'),
      guestsDelta: delta(guestsToday, guestsLastWeek, 'comensales'),
      week,
      weekMax,
      weekTotal,
      activePromotions,
      unanswered,
      average,
      latestReviews: [...reviews].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 2),
      attention,
      activity,
    }
  }, [now, promotions, reservations, reviews, tables])

  const tableName = useMemo(() => {
    const map = new Map(tables.map((table) => [table.id, table.name]))
    return (id: string) => map.get(id) ?? '—'
  }, [tables])

  const firstName = (company?.name ?? '').trim()
  const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.skeletonHeader} />
        <div className={styles.kpis}>
          {[0, 1, 2, 3].map((key) => <div key={key} className={styles.skeletonCard} />)}
        </div>
        <div className={styles.skeletonBlock} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{greeting(now)}{firstName ? `, ${firstName}` : ''}</h1>
          <p className={styles.subtitle}>
            <span className={styles.capitalize}>{dateLabel}</span> · {data.todayActive.length}{' '}
            {data.todayActive.length === 1 ? 'reserva' : 'reservas'} hoy
          </p>
        </div>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {data.pendingAttendance.length > 0 ? (
        <div className={styles.notice} role="status">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 16.5v.5" />
          </svg>
          <span className={styles.noticeText}>
            <strong>
              {data.pendingAttendance.length}{' '}
              {data.pendingAttendance.length === 1 ? 'reserva de hoy está pendiente' : 'reservas de hoy están pendientes'}
            </strong>{' '}
            de marcar asistencia.
          </span>
          <button type="button" className={styles.noticeButton} onClick={() => onOpenTab('reservations')}>
            Marcar asistencia
          </button>
        </div>
      ) : null}

      <div className={styles.kpis}>
        <section className={styles.kpi}>
          <span className={styles.kpiLabel}>Reservas hoy</span>
          <span className={styles.kpiValue}>{data.todayActive.length}</span>
          <span className={`${styles.kpiDelta} ${styles[`delta_${data.reservationsDelta.tone}`]}`}>{data.reservationsDelta.text}</span>
        </section>
        <section className={styles.kpi}>
          <span className={styles.kpiLabel}>Comensales hoy</span>
          <span className={styles.kpiValue}>{data.guestsToday}</span>
          <span className={`${styles.kpiDelta} ${styles[`delta_${data.guestsDelta.tone}`]}`}>{data.guestsDelta.text}</span>
        </section>
        <section className={styles.kpi}>
          <span className={styles.kpiLabel}>Mesas reservadas hoy</span>
          <span className={styles.kpiValue}>
            {data.tablesUsedToday}
            <span className={styles.kpiOf}> / {tables.length}</span>
          </span>
          <span className={styles.kpiDelta}>
            {tables.length > 0 ? `${Math.round((data.tablesUsedToday / tables.length) * 100)} % de tus mesas` : 'Añade mesas para recibir reservas'}
          </span>
        </section>
        <section className={styles.kpi}>
          <span className={styles.kpiLabel}>Faltas (7 días)</span>
          <span className={styles.kpiValue}>{data.noShows}</span>
          <span className={`${styles.kpiDelta} ${data.noShows > 0 ? styles.delta_down : ''}`}>
            {data.pastWeekCount > 0
              ? `${((data.noShows / data.pastWeekCount) * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} % de las reservas`
              : 'Sin reservas esta semana'}
          </span>
        </section>
      </div>

      <div className={styles.mainGrid}>
        <section className={`${styles.card} ${styles.serviceCard}`}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Servicio de hoy</h2>
              <span className={styles.cardMeta}>
                {data.todayActive.length} {data.todayActive.length === 1 ? 'reserva' : 'reservas'} · {data.guestsToday} comensales
              </span>
            </div>
            <button type="button" className={styles.linkButton} onClick={() => onOpenTab('reservations')}>
              Ver reservas →
            </button>
          </div>
          {data.todayRows.length === 0 ? (
            <div className={styles.empty}>
              <p>Hoy no tienes reservas.</p>
              <button type="button" className={styles.secondaryButton} onClick={() => onOpenTab('reservations')}>
                Ir a reservas
              </button>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Pers.</th>
                    <th scope="col">Mesa</th>
                    <th scope="col">Detalles</th>
                    <th scope="col" className={styles.alignRight}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.todayRows.map((row) => {
                    const status = rowStatus(row, now)
                    const tags = [
                      row.promotionId ? 'Promo' : '',
                      row.depositAmountCents ? `Fianza ${formatNumber((row.depositAmountCents / 100))} €` : '',
                      row.customerUid ? '' : 'Sin cuenta',
                    ].filter(Boolean)
                    return (
                      <tr key={row.id} className={row.status === 'cancelled' ? styles.rowMuted : ''}>
                        <td className={styles.time}>{timeLabel(row.startTime)}</td>
                        <td>
                          <div className={styles.client}>
                            <span className={styles.avatar} aria-hidden="true">{initials(row.clientName || '?')}</span>
                            <div className={styles.clientText}>
                              <span className={styles.clientName}>{row.clientName || 'Cliente'}</span>
                              {row.notes ? <span className={styles.clientNote}>{row.notes}</span> : null}
                            </div>
                          </div>
                        </td>
                        <td className={styles.num}>{row.pax}</td>
                        <td>{tableName(row.tableId)}</td>
                        <td>
                          <div className={styles.tags}>
                            {tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
                          </div>
                        </td>
                        <td className={styles.alignRight}>
                          <span className={`${styles.status} ${styles[`status_${status.tone}`]}`}>{status.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className={styles.sideColumn}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Requiere atención</h2>
            {data.attention.length === 0 ? (
              <p className={styles.allGood}>Todo al día. No hay nada pendiente.</p>
            ) : (
              <ul className={styles.attentionList}>
                {data.attention.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={styles.attentionItem} onClick={() => onOpenTab(item.tab)}>
                      <span className={`${styles.dot} ${styles[`dot_${item.tone}`]}`} aria-hidden="true" />
                      <span className={styles.attentionText}>
                        <span className={styles.attentionTitle}>{item.title}</span>
                        <span className={styles.attentionBody}>{item.body}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeadInline}>
              <h2 className={styles.cardTitle}>Esta semana</h2>
              <span className={styles.cardMeta}>{data.weekTotal} reservas</span>
            </div>
            <div className={styles.chart} role="img" aria-label={`Reservas por día: ${data.week.map((day) => `${day.label} ${day.count}`).join(', ')}`}>
              {data.week.map((day) => (
                <div key={day.label} className={styles.chartCol}>
                  <span className={styles.chartValue}>{day.count}</span>
                  <div
                    className={`${styles.chartBar} ${day.isToday ? styles.chartBarToday : ''}`}
                    style={{ height: `${Math.max(4, Math.round((day.count / data.weekMax) * 100))}%` }}
                  />
                  <span className={`${styles.chartLabel} ${day.isToday ? styles.chartLabelToday : ''}`}>{day.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeadInline}>
            <h2 className={styles.cardTitle}>Promociones activas</h2>
            <button type="button" className={styles.linkButton} onClick={() => onOpenTab('clients-promotions')}>Gestionar</button>
          </div>
          {data.activePromotions.length === 0 ? (
            <p className={styles.allGood}>No tienes promociones activas.</p>
          ) : (
            <ul className={styles.promoList}>
              {data.activePromotions.map((promo) => (
                <li key={promo.id} className={styles.promo}>
                  <div className={styles.promoHead}>
                    <span className={styles.promoName}>{promo.title}</span>
                    <span className={styles.promoCount}>{promo.max ? `${promo.used} / ${promo.max}` : `${promo.used} usos`}</span>
                  </div>
                  {promo.max ? (
                    <div className={styles.progress} aria-hidden="true">
                      <div className={styles.progressFill} style={{ width: `${Math.min(100, Math.round((promo.used / promo.max) * 100))}%` }} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Actividad reciente</h2>
          {data.activity.length === 0 ? (
            <p className={styles.allGood}>Aún no hay actividad.</p>
          ) : (
            <ul className={styles.activityList}>
              {data.activity.map((item) => (
                <li key={item.id} className={styles.activityItem}>
                  <span className={styles.activityWhen}>
                    {sameDay(item.at, now) ? timeLabel(item.at) : item.at.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeadInline}>
            <h2 className={styles.cardTitle}>Reseñas</h2>
            <span className={styles.cardMeta}>
              {data.average != null
                ? `${data.average.toLocaleString('es-ES', { maximumFractionDigits: 1 })} de media · ${reviews.length}`
                : 'Sin reseñas'}
            </span>
          </div>
          {data.latestReviews.length === 0 ? (
            <p className={styles.allGood}>Cuando tus clientes opinen, aparecerán aquí.</p>
          ) : (
            <ul className={styles.reviewList}>
              {data.latestReviews.map((review) => (
                <li key={review.id} className={styles.review}>
                  <div className={styles.reviewHead}>
                    <span className={styles.clientName}>{review.customerName || 'Cliente'}</span>
                    <span className={styles.stars} aria-label={`${review.rating} de 5`}>
                      {'★'.repeat(Math.round(review.rating))}
                      <span className={styles.starsOff}>{'★'.repeat(5 - Math.round(review.rating))}</span>
                    </span>
                  </div>
                  {/* Los productos y promos etiquetados vienen como [[p|…|nombre]]: se muestra solo el nombre. */}
                  {review.comment ? <p className={styles.reviewText}>{cleanReviewExcerpt(review.comment)}</p> : null}
                  {review.ownerReply ? (
                    <span className={styles.replied}>Respondida</span>
                  ) : (
                    <button type="button" className={styles.linkButton} onClick={() => onOpenTab('clients-reviews')}>
                      Responder
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default CompanyHome
