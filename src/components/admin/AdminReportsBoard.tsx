import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi, type AdminAnalytics, type AdminGeography } from '../../services/adminApi'
import { getCompanyPlan, parseCompanyPlanId } from '../../data/companyPlans'
import styles from './AdminReportsBoard.module.css'

type Metric = 'reservations' | 'revenueCents' | 'newCustomers' | 'claims' | 'pax'
type SortKey = 'reservations' | 'pax' | 'revenueCents' | 'noShows' | 'claims' | 'avgRating'

const METRICS: Array<{ id: Metric; label: string }> = [
  { id: 'reservations', label: 'Reservas' },
  { id: 'revenueCents', label: 'Ingresos' },
  { id: 'newCustomers', label: 'Clientes nuevos' },
  { id: 'pax', label: 'Comensales' },
  { id: 'claims', label: 'Canjes' },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const STATUS_LABEL: Record<string, string> = { paid: 'Cobrada', refunded: 'Devuelta', failed: 'Fallida' }

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const integer = new Intl.NumberFormat('es-ES')

function money(cents: number): string {
  return euros.format(cents / 100)
}

function ymd(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function presetRange(id: string): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (id) {
    case 'month': return { from: ymd(new Date(y, m, 1)), to: ymd(today) }
    case 'lastMonth': return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) }
    case 'quarter': return { from: ymd(new Date(y, Math.floor(m / 3) * 3, 1)), to: ymd(today) }
    case 'year': return { from: ymd(new Date(y, 0, 1)), to: ymd(today) }
    case 'lastYear': return { from: ymd(new Date(y - 1, 0, 1)), to: ymd(new Date(y - 1, 11, 31)) }
    case '90': return { from: ymd(new Date(today.getTime() - 89 * 86400000)), to: ymd(today) }
    default: return { from: ymd(new Date(today.getTime() - 29 * 86400000)), to: ymd(today) }
  }
}

const PRESETS = [
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes pasado' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Este año' },
  { id: 'lastYear', label: 'Año pasado' },
]

function delta(current: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    return current === 0 ? { text: 'igual que antes', tone: 'flat' } : { text: 'nuevo en el periodo', tone: 'up' }
  }
  const change = ((current - previous) / previous) * 100
  if (Math.abs(change) < 0.5) return { text: 'igual que antes', tone: 'flat' }
  return { text: `${change > 0 ? '+' : ''}${change.toFixed(0)} % vs periodo anterior`, tone: change > 0 ? 'up' : 'down' }
}

function percent(part: number, total: number): string {
  return total > 0 ? `${((part / total) * 100).toFixed(1).replace('.', ',')} %` : '—'
}

function planName(planId: string): string {
  if (!planId || planId === 'otro') return 'Sin plan'
  return getCompanyPlan(parseCompanyPlanId(planId)).name
}

function bucketLabel(key: string, granularity: 'day' | 'month'): string {
  if (granularity === 'month') {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
  }
  const [, m, d] = key.split('-')
  return `${d}/${m}`
}

function downloadCsv(name: string, rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value)
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  // Punto y coma y BOM: Excel en español lo abre bien con tildes.
  const csv = '﻿' + rows.map((row) => row.map(escape).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'up' | 'down' | 'flat' }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <strong className={styles.kpiValue}>{value}</strong>
      {hint ? <span className={`${styles.kpiHint} ${tone ? styles[`tone_${tone}`] : ''}`}>{hint}</span> : null}
    </div>
  )
}

function BarList({ rows, total, format = (n: number) => integer.format(n) }: {
  rows: Array<{ name: string; value: number; extra?: string }>
  total?: number
  format?: (n: number) => string
}) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  if (rows.length === 0) return <p className={styles.empty}>Sin datos en este periodo.</p>
  return (
    <ul className={styles.barList}>
      {rows.map((row) => (
        <li key={row.name}>
          <span className={styles.barName}>{row.name}</span>
          <span className={styles.barTrack}><span style={{ width: `${(row.value / max) * 100}%` }} /></span>
          <span className={styles.barValue}>
            {format(row.value)}
            {total ? <small> · {percent(row.value, total)}</small> : null}
            {row.extra ? <small> · {row.extra}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SeriesChart({ data, metric }: { data: AdminAnalytics; metric: Metric }) {
  const values = data.series.map((bucket) => bucket[metric])
  const max = Math.max(1, ...values)
  const total = values.reduce((sum, value) => sum + value, 0)
  const step = Math.max(1, Math.ceil(data.series.length / 12))
  const format = (value: number) => (metric === 'revenueCents' ? money(value) : integer.format(value))
  return (
    <div className={styles.chart}>
      <div className={styles.chartMeta}>
        <span>Total: <strong>{format(total)}</strong></span>
        <span>Máximo: <strong>{format(max === 1 && total === 0 ? 0 : max)}</strong></span>
      </div>
      <div className={styles.bars} role="img" aria-label={`Evolución de ${METRICS.find((m) => m.id === metric)?.label}`}>
        {data.series.map((bucket, index) => (
          <div key={bucket.key} className={styles.barCol} title={`${bucketLabel(bucket.key, data.range.granularity)}: ${format(bucket[metric])}`}>
            <span className={styles.bar} style={{ height: `${(bucket[metric] / max) * 100}%` }} />
            <span className={styles.barLabel}>{index % step === 0 ? bucketLabel(bucket.key, data.range.granularity) : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminReportsBoard() {
  const initial = presetRange('30')
  const [preset, setPreset] = useState('30')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [includeTest, setIncludeTest] = useState(false)
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [geo, setGeo] = useState<AdminGeography | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('reservations')
  const [sortKey, setSortKey] = useState<SortKey>('reservations')
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [invoiceStatus, setInvoiceStatus] = useState('all')
  const [openCountry, setOpenCountry] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!from || !to || from > to) {
      setError('La fecha «desde» tiene que ser anterior a «hasta».')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await adminApi.analytics(from, to, includeTest))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los informes.')
    } finally {
      setLoading(false)
    }
  }, [from, to, includeTest])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    adminApi.geography().then(setGeo).catch(() => setGeo(null))
  }, [])

  const choosePreset = (id: string) => {
    const range = presetRange(id)
    setPreset(id)
    setFrom(range.from)
    setTo(range.to)
  }

  const sortedCompanies = useMemo(() => {
    const rows = [...(data?.topCompanies ?? [])]
    return rows.sort((a, b) => ((b[sortKey] ?? -1) as number) - ((a[sortKey] ?? -1) as number))
  }, [data, sortKey])

  const invoices = useMemo(() => {
    const needle = invoiceQuery.trim().toLowerCase()
    return (data?.invoices ?? []).filter((row) => (
      (invoiceStatus === 'all' || row.status === invoiceStatus)
      && (!needle || `${row.companyName} ${row.customerEmail} ${row.id}`.toLowerCase().includes(needle))
    ))
  }, [data, invoiceQuery, invoiceStatus])

  const exportSummary = () => {
    if (!data) return
    const k = data.kpis
    downloadCsv(`adelia-informe-${data.range.from}-${data.range.to}.csv`, [
      ['Informe Adelia', `${data.range.from} a ${data.range.to}`],
      [],
      ['Indicador', 'Valor'],
      ['Ingresos netos (€)', (k.revenueNetCents / 100).toFixed(2)],
      ['Ingresos brutos (€)', (k.revenueGrossCents / 100).toFixed(2)],
      ['IVA (€)', (k.taxCents / 100).toFixed(2)],
      ['Devoluciones (€)', (k.refundsCents / 100).toFixed(2)],
      ['Facturas cobradas', k.invoices],
      ['Cobros fallidos', k.failedPayments],
      ['Clientes nuevos', k.newCustomers],
      ['Restaurantes nuevos', k.newCompanies],
      ['Reservas', k.reservations],
      ['Comensales', k.pax],
      ['Asistieron', k.attended],
      ['Pendientes', k.pending],
      ['Canceladas por el cliente', k.cancelledByClient],
      ['Canceladas por el restaurante', k.cancelledByRestaurant],
      ['No se presentaron', k.noShows],
      ['Canjes de promociones', k.claims],
      ['Reseñas', k.reviews],
      [],
      ['Periodo', 'Reservas', 'Canceladas', 'No presentados', 'Comensales', 'Clientes nuevos', 'Restaurantes nuevos', 'Ingresos (€)', 'Canjes'],
      ...data.series.map((b) => [b.key, b.reservations, b.cancelled, b.noShows, b.pax, b.newCustomers, b.newCompanies, (b.revenueCents / 100).toFixed(2), b.claims]),
      [],
      ['Restaurante', 'Ciudad', 'Plan', 'Reservas', 'Comensales', 'Canceladas', 'No presentados', 'Canjes', 'Reseñas', 'Nota', 'Ingresos (€)'],
      ...data.topCompanies.map((c) => [c.name, c.municipality, planName(c.planId), c.reservations, c.pax, c.cancelled, c.noShows, c.claims, c.reviews, c.avgRating ?? '', (c.revenueCents / 100).toFixed(2)]),
    ])
  }

  const exportInvoices = () => {
    if (!data) return
    downloadCsv(`adelia-facturas-${data.range.from}-${data.range.to}.csv`, [
      ['Fecha', 'Restaurante', 'Correo', 'Plan', 'Tipo', 'Estado', 'Total (€)', 'IVA (€)', 'Devuelto (€)', 'Neto (€)', 'Prueba', 'Factura'],
      ...invoices.map((row) => [
        row.paidAt ? new Date(row.paidAt).toLocaleString('es-ES') : '',
        row.companyName, row.customerEmail, planName(row.planId),
        row.kind === 'order' ? 'Pago único' : 'Suscripción', STATUS_LABEL[row.status] ?? row.status,
        (row.totalCents / 100).toFixed(2), (row.taxCents / 100).toFixed(2), (row.refundedCents / 100).toFixed(2), (row.netCents / 100).toFixed(2),
        row.testMode ? 'Sí' : 'No', row.invoiceUrl,
      ]),
    ])
  }

  const k = data?.kpis
  const finished = k ? k.attended + k.noShows : 0
  const cancelledTotal = k ? k.cancelledByClient + k.cancelledByRestaurant : 0

  return (
    <div className={styles.board}>
      <section className={styles.toolbar} aria-label="Periodo del informe">
        <div className={styles.presets}>
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.chip} ${preset === item.id ? styles.chipOn : ''}`}
              onClick={() => choosePreset(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.dates}>
          <label>
            <span>Desde</span>
            <input type="date" value={from} max={to} onChange={(e) => { setPreset('custom'); setFrom(e.target.value) }} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={to} min={from} onChange={(e) => { setPreset('custom'); setTo(e.target.value) }} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
            <span>Incluir pagos de prueba</span>
          </label>
          <button type="button" className={styles.ghost} onClick={() => void load()} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button type="button" className={styles.primary} onClick={exportSummary} disabled={!data}>
            Exportar informe
          </button>
        </div>
      </section>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {data?.truncated ? (
        <p className={styles.warning}>Hay más de 20.000 registros en este periodo: algunos totales están recortados. Elige un periodo más corto.</p>
      ) : null}

      {!data && loading ? <div className={styles.skeleton} aria-busy="true">Calculando el informe…</div> : null}

      {data && k ? (
        <>
          <p className={styles.periodNote}>
            {new Date(`${data.range.from}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' – '}
            {new Date(`${data.range.to}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{data.range.days} días · se compara con {data.previous.from} – {data.previous.to}
          </p>

          <h2 className={styles.sectionTitle}>Dinero</h2>
          <div className={styles.kpis}>
            <Kpi label="Ingresos netos" value={money(k.revenueNetCents)} {...(() => { const d = delta(k.revenueNetCents, k.prev.revenueNetCents); return { hint: d.text, tone: d.tone } })()} />
            <Kpi label="Facturado (con IVA)" value={money(k.revenueGrossCents)} hint={`IVA ${money(k.taxCents)}`} />
            <Kpi label="Facturas cobradas" value={integer.format(k.invoices)} hint={k.failedPayments > 0 ? `${k.failedPayments} cobros fallidos` : 'sin cobros fallidos'} tone={k.failedPayments > 0 ? 'down' : 'flat'} />
            <Kpi label="Ticket medio" value={money(k.avgTicketCents)} hint={`Devoluciones ${money(k.refundsCents)}`} />
          </div>

          <h2 className={styles.sectionTitle}>Crecimiento y uso</h2>
          <div className={styles.kpis}>
            <Kpi label="Clientes nuevos" value={integer.format(k.newCustomers)} {...(() => { const d = delta(k.newCustomers, k.prev.newCustomers); return { hint: d.text, tone: d.tone } })()} />
            <Kpi label="Restaurantes nuevos" value={integer.format(k.newCompanies)} />
            <Kpi label="Reservas" value={integer.format(k.reservations)} {...(() => { const d = delta(k.reservations, k.prev.reservations); return { hint: d.text, tone: d.tone } })()} />
            <Kpi label="Comensales" value={integer.format(k.pax)} hint={k.reservations > 0 ? `${(k.pax / k.reservations).toFixed(1).replace('.', ',')} por reserva` : undefined} />
            <Kpi label="Asistencia" value={percent(k.attended, finished)} hint={`${k.noShows} no se presentaron`} tone={k.noShows > 0 ? 'down' : 'flat'} />
            <Kpi label="Cancelación" value={percent(cancelledTotal, k.reservations)} hint={`${k.cancelledByClient} cliente · ${k.cancelledByRestaurant} local`} />
            <Kpi label="Canjes de promos" value={integer.format(k.claims)} hint={`${percent(k.withPromotion, k.reservations)} reservas con promo`} />
            <Kpi label="Reseñas" value={integer.format(k.reviews)} hint={k.avgRating != null ? `nota media ${String(k.avgRating).replace('.', ',')} / 5` : 'sin reseñas'} />
          </div>

          <section className={styles.card}>
            <header className={styles.cardHead}>
              <h3>Evolución {data.range.granularity === 'day' ? 'diaria' : 'mensual'}</h3>
              <div className={styles.segmented} role="tablist" aria-label="Qué ver en la gráfica">
                {METRICS.map((item) => (
                  <button key={item.id} type="button" role="tab" aria-selected={metric === item.id} className={metric === item.id ? styles.segOn : ''} onClick={() => setMetric(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </header>
            <SeriesChart data={data} metric={metric} />
          </section>

          <div className={styles.grid2}>
            <section className={styles.card}>
              <header className={styles.cardHead}><h3>Ingresos por mes</h3></header>
              {data.revenueByMonth.length === 0 ? <p className={styles.empty}>Sin cobros en este periodo.</p> : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Mes</th><th>Facturas</th><th>Bruto</th><th>IVA</th><th>Devuelto</th><th>Neto</th></tr></thead>
                    <tbody>
                      {data.revenueByMonth.map((row) => (
                        <tr key={row.month}>
                          <td>{bucketLabel(row.month, 'month')}</td>
                          <td>{row.invoices}</td>
                          <td>{money(row.grossCents)}</td>
                          <td>{money(row.taxCents)}</td>
                          <td>{money(row.refundsCents)}</td>
                          <td><strong>{money(row.netCents)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><td>Total</td><td>{k.invoices}</td><td>{money(k.revenueGrossCents)}</td><td>{money(k.taxCents)}</td><td>{money(k.refundsCents)}</td><td><strong>{money(k.revenueNetCents)}</strong></td></tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
            <section className={styles.card}>
              <header className={styles.cardHead}><h3>Ingresos por plan</h3></header>
              <BarList
                rows={data.revenueByPlan.map((row) => ({ name: planName(row.planId), value: row.netCents, extra: `${row.invoices} facturas` }))}
                total={k.revenueNetCents}
                format={money}
              />
              <h4 className={styles.subTitle}>Estado de las reservas</h4>
              <BarList
                rows={[
                  { name: 'Asistieron', value: k.attended },
                  { name: 'Pendientes de pasar lista', value: k.pending },
                  { name: 'Canceló el cliente', value: k.cancelledByClient },
                  { name: 'Canceló el local', value: k.cancelledByRestaurant },
                  { name: 'No se presentaron', value: k.noShows },
                ]}
                total={k.reservations}
              />
            </section>
          </div>

          <div className={styles.grid2}>
            <section className={styles.card}>
              <header className={styles.cardHead}><h3>Hora de las reservas</h3></header>
              <div className={styles.miniBars}>
                {data.byHour.map((value, hour) => (
                  <span key={hour} title={`${hour}:00 · ${value}`} style={{ height: `${(value / Math.max(1, ...data.byHour)) * 100}%` }} />
                ))}
              </div>
              <div className={styles.miniAxis}><span>0 h</span><span>12 h</span><span>23 h</span></div>
            </section>
            <section className={styles.card}>
              <header className={styles.cardHead}><h3>Día de la semana</h3></header>
              <BarList rows={data.byWeekday.map((value, i) => ({ name: WEEKDAYS[i], value }))} total={k.reservations} />
            </section>
          </div>

          <section className={styles.card}>
            <header className={styles.cardHead}>
              <h3>Restaurantes del periodo</h3>
              <label className={styles.inlineSelect}>
                <span>Ordenar por</span>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                  <option value="reservations">Reservas</option>
                  <option value="pax">Comensales</option>
                  <option value="revenueCents">Ingresos</option>
                  <option value="noShows">No presentados</option>
                  <option value="claims">Canjes</option>
                  <option value="avgRating">Nota</option>
                </select>
              </label>
            </header>
            {sortedCompanies.length === 0 ? <p className={styles.empty}>Ningún restaurante con actividad en este periodo.</p> : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Restaurante</th><th>Plan</th><th>Reservas</th><th>Comensales</th><th>Canceladas</th><th>No vinieron</th><th>Canjes</th><th>Nota</th><th>Ingresos</th></tr></thead>
                  <tbody>
                    {sortedCompanies.map((row) => (
                      <tr key={row.id}>
                        <td><strong>{row.name}</strong><small>{row.municipality || '—'}</small></td>
                        <td>{planName(row.planId)}</td>
                        <td>{row.reservations}</td>
                        <td>{row.pax}</td>
                        <td>{row.cancelled}</td>
                        <td>{row.noShows}</td>
                        <td>{row.claims}</td>
                        <td>{row.avgRating != null ? String(row.avgRating).replace('.', ',') : '—'}</td>
                        <td>{money(row.revenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <h2 className={styles.sectionTitle}>Dónde está la gente</h2>
          <div className={styles.grid3}>
            <section className={styles.card}>
              <header className={styles.cardHead}><h3>Reservas por ciudad</h3><small>en el periodo</small></header>
              <BarList rows={data.reservationsByCity.map((row) => ({ name: row.city, value: row.reservations, extra: `${row.pax} pax` }))} total={k.reservations} />
            </section>
            <section className={styles.card}>
              <header className={styles.cardHead}><h3>Clientes nuevos por ciudad</h3><small>en el periodo</small></header>
              <BarList rows={data.newCustomersByCity.map((row) => ({ name: row.name, value: row.count }))} total={k.newCustomers} />
            </section>
            <section className={styles.card}>
              <header className={styles.cardHead}><h3>Clientes nuevos por país</h3><small>en el periodo</small></header>
              <BarList rows={data.newCustomersByCountry.map((row) => ({ name: row.name, value: row.count }))} total={k.newCustomers} />
            </section>
          </div>

          {geo ? (
            <div className={styles.grid2}>
              <section className={styles.card}>
                <header className={styles.cardHead}><h3>Todos los clientes por país</h3><small>{integer.format(geo.totalCustomers)} en total · pulsa para ver ciudades</small></header>
                <ul className={styles.countryList}>
                  {geo.customersByCountry.map((row) => (
                    <li key={row.country}>
                      <button type="button" aria-expanded={openCountry === row.country} onClick={() => setOpenCountry(openCountry === row.country ? null : row.country)}>
                        <span>{row.country}</span>
                        <span>{integer.format(row.customers)} · {percent(row.customers, geo.totalCustomers)}</span>
                      </button>
                      {openCountry === row.country ? (
                        <BarList rows={row.cities.map((city) => ({ name: city.city, value: city.customers }))} total={row.customers} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.card}>
                <header className={styles.cardHead}><h3>Restaurantes por ciudad</h3><small>{integer.format(geo.totalCompanies)} en total</small></header>
                <BarList rows={geo.companiesByCity.map((row) => ({ name: row.city, value: row.companies, extra: `${row.paid} de pago · ${row.active} activos` }))} total={geo.totalCompanies} />
              </section>
            </div>
          ) : null}

          <section className={styles.card}>
            <header className={styles.cardHead}>
              <h3>Facturas y cobros</h3>
              <div className={styles.invoiceTools}>
                <input type="search" placeholder="Buscar restaurante o correo…" value={invoiceQuery} onChange={(e) => setInvoiceQuery(e.target.value)} aria-label="Buscar factura" />
                <select value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)} aria-label="Estado de la factura">
                  <option value="all">Todas</option>
                  <option value="paid">Cobradas</option>
                  <option value="refunded">Devueltas</option>
                  <option value="failed">Fallidas</option>
                </select>
                <button type="button" className={styles.ghost} onClick={exportInvoices} disabled={invoices.length === 0}>Exportar CSV</button>
              </div>
            </header>
            {invoices.length === 0 ? (
              <p className={styles.empty}>
                No hay cobros en este periodo. Los cobros se apuntan desde ahora, con cada pago o devolución que avise Lemon Squeezy.
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Fecha</th><th>Restaurante</th><th>Plan</th><th>Estado</th><th>Total</th><th>IVA</th><th>Neto</th><th>Factura</th></tr></thead>
                  <tbody>
                    {invoices.map((row) => (
                      <tr key={row.id}>
                        <td>{row.paidAt ? new Date(row.paidAt).toLocaleDateString('es-ES') : '—'}</td>
                        <td><strong>{row.companyName || '—'}</strong><small>{row.customerEmail}</small></td>
                        <td>{planName(row.planId)}{row.kind === 'order' ? ' · único' : ''}</td>
                        <td><span className={`${styles.pill} ${styles[`pill_${row.status}`] ?? ''}`}>{STATUS_LABEL[row.status] ?? row.status}{row.testMode ? ' · prueba' : ''}</span></td>
                        <td>{money(row.totalCents)}</td>
                        <td>{money(row.taxCents)}</td>
                        <td><strong>{money(row.netCents)}</strong></td>
                        <td>{row.invoiceUrl ? <a href={row.invoiceUrl} target="_blank" rel="noopener noreferrer">Ver</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

export default AdminReportsBoard
