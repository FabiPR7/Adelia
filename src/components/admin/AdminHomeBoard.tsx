import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminDayStats, type AdminStats } from '../../services/adminApi'
import styles from './AdminPanel.module.css'

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
] as const

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('es-ES')
const pct = (value: number) => `${Math.round(value * 1000) / 10}%`

function sum(series: AdminDayStats[], key: keyof AdminDayStats): number {
  return series.reduce((total, day) => total + (typeof day[key] === 'number' ? (day[key] as number) : 0), 0)
}

function delta(current: number, previous: number): { text: string; good: boolean } | null {
  if (previous <= 0) return current > 0 ? { text: 'nuevo', good: true } : null
  const change = (current - previous) / previous
  return { text: `${change >= 0 ? '+' : ''}${Math.round(change * 100)}% vs periodo anterior`, good: change >= 0 }
}

/** Línea doble (reservas y altas) en SVG, sin librerías. */
function TrendChart({ series }: { series: AdminDayStats[] }) {
  const width = 640
  const height = 180
  const pad = 8
  const maxValue = Math.max(1, ...series.map((day) => Math.max(day.reservations, day.newCustomers)))
  const point = (index: number, value: number) => {
    const x = pad + (index / Math.max(1, series.length - 1)) * (width - pad * 2)
    const y = height - pad - (value / maxValue) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }
  const line = (key: 'reservations' | 'newCustomers') => series.map((day, index) => point(index, day[key])).join(' ')
  const area = `${pad},${height - pad} ${line('reservations')} ${width - pad},${height - pad}`
  return (
    <>
      <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Reservas y altas por día">
        <defs>
          <linearGradient id="adminTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c4472f" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#c4472f" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={pad} x2={width - pad} y1={pad + ratio * (height - pad * 2)} y2={pad + ratio * (height - pad * 2)} stroke="rgba(61,42,31,0.08)" strokeDasharray="3 4" />
        ))}
        <polygon points={area} fill="url(#adminTrendFill)" />
        <polyline points={line('reservations')} fill="none" stroke="#c4472f" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <polyline points={line('newCustomers')} fill="none" stroke="#b5792a" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={styles.barLabels}>
        <span>{series[0]?.day.slice(5).split('-').reverse().join('/')}</span>
        <span>Máximo diario: {num.format(maxValue)}</span>
        <span>Hoy</span>
      </div>
      <div className={styles.chartLegend}>
        <span><i style={{ background: '#c4472f' }} />Reservas</span>
        <span><i style={{ background: '#b5792a' }} />Clientes nuevos</span>
      </div>
    </>
  )
}

function Bars({ values, labels, title }: { values: number[]; labels: [string, string, string]; title: string }) {
  const max = Math.max(1, ...values)
  return (
    <>
      <div className={styles.bars} role="img" aria-label={title}>
        {values.map((value, index) => (
          <div key={index} style={{ height: `${Math.max(3, (value / max) * 100)}%` }} title={`${value}`} />
        ))}
      </div>
      <div className={styles.barLabels}>
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
        <span>{labels[2]}</span>
      </div>
    </>
  )
}

interface AdminHomeBoardProps {
  onOpenCompany: (companyId: string) => void
  onNavigate: (view: 'companies' | 'plans' | 'customers' | 'security') => void
}

function AdminHomeBoard({ onOpenCompany, onNavigate }: AdminHomeBoardProps) {
  const [days, setDays] = useState<number>(30)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [previous, setPrevious] = useState<AdminDayStats[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (range: number) => {
    setLoading(true)
    setError(null)
    try {
      // Se pide el doble para comparar con el periodo anterior (máximo un año).
      const doubled = Math.min(365, range * 2)
      const result = await adminApi.stats(doubled)
      const current = result.series.slice(-range)
      const before = doubled >= range * 2 ? result.series.slice(0, result.series.length - range) : null
      setStats({ ...result, series: current })
      setPrevious(before)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(days)
  }, [days, load])

  const summary = useMemo(() => {
    if (!stats) return null
    const series = stats.series
    const reservations = sum(series, 'reservations')
    const cancelled = sum(series, 'cancelled')
    const newCustomers = sum(series, 'newCustomers')
    const newCompanies = sum(series, 'newCompanies')
    const pax = sum(series, 'pax')
    const fromCustomers = sum(series, 'fromCustomers')
    const withPromotion = sum(series, 'withPromotion')
    const byHour = Array.from({ length: 24 }, (_, hour) => series.reduce((total, day) => total + (day.byHour[hour] ?? 0), 0))
    const byWeekday = Array.from({ length: 7 }, (_, weekday) => series.filter((day) => day.weekday === weekday).reduce((total, day) => total + day.reservations, 0))
    const today = series[series.length - 1]
    return {
      reservations,
      cancelled,
      newCustomers,
      newCompanies,
      pax,
      fromCustomers,
      withPromotion,
      byHour,
      // Lunes primero.
      byWeekday: [...byWeekday.slice(1), byWeekday[0]],
      today,
      prevReservations: previous ? sum(previous, 'reservations') : 0,
      prevCustomers: previous ? sum(previous, 'newCustomers') : 0,
    }
  }, [stats, previous])

  const rangeButtons = (
    <div className={styles.segment} role="tablist" aria-label="Periodo">
      {RANGES.map((range) => (
        <button
          key={range.days}
          type="button"
          role="tab"
          aria-selected={days === range.days}
          className={days === range.days ? styles.segmentOn : ''}
          onClick={() => setDays(range.days)}
        >
          {range.label}
        </button>
      ))}
    </div>
  )

  if (error) {
    return (
      <div className={styles.wrap}>
        <div className={`${styles.notice} ${styles.noticeBad}`}>{error}</div>
        <div><button type="button" className={styles.button} onClick={() => void load(days)}>Reintentar</button></div>
      </div>
    )
  }

  if (loading || !stats || !summary) {
    return (
      <div className={styles.wrap}>
        <div className={styles.spread}>{rangeButtons}</div>
        <div className={styles.kpiGrid}>
          {Array.from({ length: 8 }, (_, index) => <div key={index} className={styles.skeleton} style={{ height: 96 }} />)}
        </div>
        <div className={styles.skeleton} style={{ height: 260 }} />
      </div>
    )
  }

  const { totals, revenue } = stats
  const reservationsDelta = previous ? delta(summary.reservations, summary.prevReservations) : null
  const customersDelta = previous ? delta(summary.newCustomers, summary.prevCustomers) : null
  const cancelRate = summary.reservations > 0 ? summary.cancelled / summary.reservations : 0
  const totalPlans = Math.max(1, stats.plans.reduce((total, plan) => total + plan.total, 0))

  return (
    <div className={styles.wrap}>
      <div className={styles.spread}>
        {rangeButtons}
        <p className={styles.muted}>
          Actualizado {new Date(stats.generatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className={styles.kpiGrid}>
        <article className={`${styles.kpi} ${styles.kpiDark}`}>
          <span>Ingresos al mes</span>
          <strong>{euro.format(revenue.mrr)}</strong>
          <em>{totals.paidCompanies} de pago · {revenue.perpetual} de por vida</em>
        </article>
        <article className={styles.kpi}>
          <span>Restaurantes activos</span>
          <strong>{num.format(totals.activeCompanies)}</strong>
          <em>{pct(revenue.conversion)} pagan · {totals.featuredCompanies} destacados</em>
        </article>
        <article className={styles.kpi}>
          <span>Clientes</span>
          <strong>{num.format(totals.customers)}</strong>
          <em className={customersDelta ? (customersDelta.good ? styles.up : styles.down) : ''}>
            +{num.format(summary.newCustomers)} en el periodo{customersDelta ? ` · ${customersDelta.text}` : ''}
          </em>
        </article>
        <article className={styles.kpi}>
          <span>Reservas del periodo</span>
          <strong>{num.format(summary.reservations)}</strong>
          <em className={reservationsDelta ? (reservationsDelta.good ? styles.up : styles.down) : ''}>
            {reservationsDelta ? reservationsDelta.text : `${num.format(summary.pax)} comensales`}
          </em>
        </article>
        <article className={styles.kpi}>
          <span>Hoy</span>
          <strong>{num.format(summary.today?.reservations ?? 0)}</strong>
          <em>reservas · {summary.today?.newCustomers ?? 0} altas</em>
        </article>
        <article className={styles.kpi}>
          <span>Próximas reservas</span>
          <strong>{num.format(totals.upcoming)}</strong>
          <em>{num.format(totals.reservations)} en total</em>
        </article>
        <article className={styles.kpi}>
          <span>Cancelación</span>
          <strong className={cancelRate > 0.2 ? styles.down : ''}>{pct(cancelRate)}</strong>
          <em>{num.format(summary.cancelled)} canceladas en el periodo</em>
        </article>
        <article className={styles.kpi}>
          <span>Uso de la app</span>
          <strong>{summary.reservations > 0 ? pct(summary.fromCustomers / summary.reservations) : '—'}</strong>
          <em>reservas con cuenta · {num.format(summary.withPromotion)} con promoción</em>
        </article>
      </div>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Actividad diaria</h3>
            <p>{summary.newCompanies} restaurantes nuevos en el periodo</p>
          </div>
          <TrendChart series={stats.series} />
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Planes</h3>
            <button type="button" className={styles.buttonGhost} onClick={() => onNavigate('plans')}>Gestionar</button>
          </div>
          <ul className={styles.meterList}>
            {stats.plans.map((plan) => (
              <li key={plan.planId}>
                <span>{plan.name}</span>
                <b>{plan.total}{plan.mrr > 0 ? ` · ${euro.format(plan.mrr)}/mes` : ''}</b>
                <div className={styles.meter}><span style={{ width: `${(plan.total / totalPlans) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          {totals.subscriptionsPending > 0 ? (
            <p className={`${styles.notice} ${styles.noticeInfo}`} style={{ marginTop: '0.8rem' }}>
              {totals.subscriptionsPending} pago(s) de Lemon esperando a que el local se registre.
            </p>
          ) : null}
        </section>
      </div>

      <div className={styles.grid3}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Hora de reserva</h3>
            <p>Cuándo reserva la gente</p>
          </div>
          <Bars values={summary.byHour} labels={['0 h', '12 h', '23 h']} title="Reservas por hora del día" />
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Día de la semana</h3>
            <p>Días con más reservas</p>
          </div>
          <Bars values={summary.byWeekday} labels={[WEEKDAYS[1], WEEKDAYS[4], WEEKDAYS[0]]} title="Reservas por día de la semana" />
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Comunidad</h3>
          </div>
          <ul className={styles.meterList}>
            <li>
              <span>Teléfono verificado</span>
              <b>{totals.customers > 0 ? pct(totals.phoneVerified / totals.customers) : '—'}</b>
              <div className={styles.meter}><span style={{ width: `${totals.customers > 0 ? (totals.phoneVerified / totals.customers) * 100 : 0}%` }} /></div>
            </li>
            <li>
              <span>Reseñas publicadas</span>
              <b>{num.format(totals.reviews)}</b>
            </li>
            <li>
              <span>Promociones canjeadas</span>
              <b>{num.format(totals.promotionClaims)}</b>
            </li>
            <li>
              <button type="button" className={styles.rowButton} onClick={() => onNavigate('customers')}>
                <span>Clientes bloqueados</span>
              </button>
              <b className={totals.blockedCustomers > 0 ? styles.down : ''}>{num.format(totals.blockedCustomers)}</b>
            </li>
          </ul>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3>Restaurantes con más reservas</h3>
          <button type="button" className={styles.buttonGhost} onClick={() => onNavigate('companies')}>Ver todos</button>
        </div>
        {stats.topCompanies.length === 0 ? (
          <p className={styles.muted}>Todavía no hay reservas en este periodo.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Restaurante</th>
                  <th>Plan</th>
                  <th className={styles.num}>Reservas</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCompanies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <button type="button" className={styles.rowButton} onClick={() => onOpenCompany(company.id)}>
                        <strong>{company.name}</strong>
                        <em>{company.municipality || 'Sin ciudad'}</em>
                      </button>
                    </td>
                    <td><span className={styles.chip}>{stats.plans.find((plan) => plan.planId === company.planId)?.name ?? company.planId}</span></td>
                    <td className={styles.num}>{num.format(company.reservations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminHomeBoard
