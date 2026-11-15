import { useCallback, useEffect, useMemo, useState } from 'react'
import ClientReservationDatePicker from '../../components/ClientReservationDatePicker'
import {
  getCompanyClientsPage,
  isNewCompanyClient,
  type CompanyClientsPage,
} from '../../services/companyClients'
import { getFirestoreErrorMessage, getReservationsByCompany, getTablesByCompany, tablesToMeta } from '../../services/firestore'
import { COMPANY_CLIENT_RESERVATION_LIMIT } from '../../services/firestoreQuery'
import type { CompanyClient, Reservation } from '../../types'
import { dateToIsoDate, dateToTimeInput, formatDateSpanish, formatTimeSpanish } from '../../utils/helpers'
import styles from './CompanyClients.module.css'

interface CompanyClientsProps {
  companyId: string
}

/** Estado tal como lo entiende el local (el servidor guarda las activas como `completed`). */
function reservationStatus(reservation: Reservation, now: number): { label: string; className: string } {
  if (reservation.status === 'cancelled') {
    return reservation.noShow
      ? { label: 'No vino', className: styles.statusDanger }
      : { label: 'Cancelada', className: styles.statusMuted }
  }
  if (reservation.status === 'confirmed') return { label: 'Asistió', className: styles.statusOk }
  return reservation.startTime.getTime() <= now
    ? { label: 'Por marcar', className: styles.statusWarn }
    : { label: 'Reservada', className: styles.statusInfo }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

type ClientSegment = 'all' | 'regular' | 'new'

const REGULAR_MIN_RESERVATIONS = 3
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** «Hoy», «Ayer», «Hace 5 días»… y la fecha corta a partir de un mes. */
function relativeDay(date: Date, now = Date.now()): string {
  const day = 24 * 60 * 60 * 1000
  const startOf = (value: number) => {
    const d = new Date(value)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const diff = Math.round((startOf(now) - startOf(date.getTime())) / day)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff === -1) return 'Mañana'
  if (diff < 0) return `En ${Math.abs(diff)} días`
  if (diff < 30) return `Hace ${diff} días`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/** El valor que más se repite (o null si la lista está vacía). */
function mostFrequent<T>(values: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best: { value: T; count: number } | null = null
  for (const [value, count] of counts) {
    if (!best || count > best.count) {
      best = { value, count }
    }
  }
  return best
}

function CompanyClients({ companyId }: CompanyClientsProps) {
  const [clients, setClients] = useState<CompanyClient[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tableMeta, setTableMeta] = useState<Record<string, { name: string; capacity: number }>>({})
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [segment, setSegment] = useState<ClientSegment>('all')
  const [reservationDateFilter, setReservationDateFilter] = useState('')
  const [reservationTimeFilter, setReservationTimeFilter] = useState('')
  const [reservationTableFilter, setReservationTableFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientsCursor, setClientsCursor] = useState<CompanyClientsPage['cursor']>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    setError(null)

    try {
      const [clientPage, tableRows] = await Promise.all([
        getCompanyClientsPage(companyId),
        getTablesByCompany(companyId),
      ])
      const clientRows = clientPage.clients

      setClients(clientRows)
      setClientsCursor(clientPage.cursor)
      setTableMeta(tablesToMeta(tableRows))

      setSelectedClientId((current) => {
        if (current && clientRows.some((client) => client.id === current)) {
          return current
        }

        return clientRows[0]?.id ?? null
      })
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      if (refresh) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }, [companyId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const loadMoreClients = async () => {
    if (!clientsCursor || loadingMore) {
      return
    }
    setLoadingMore(true)
    try {
      const next = await getCompanyClientsPage(companyId, clientsCursor)
      setClients((current) => [...current, ...next.clients.filter((client) => !current.some((item) => item.id === client.id))])
      setClientsCursor(next.cursor)
    } catch (err) {
      setError(getFirestoreErrorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    setReservationDateFilter('')
    setReservationTimeFilter('')
    setReservationTableFilter('')
  }, [selectedClientId])

  const segmentCounts = useMemo(() => ({
    all: clients.length,
    regular: clients.filter((client) => client.reservationCount >= REGULAR_MIN_RESERVATIONS).length,
    new: clients.filter((client) => isNewCompanyClient(client)).length,
  }), [clients])

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return clients.filter((client) => {
      if (segment === 'regular' && client.reservationCount < REGULAR_MIN_RESERVATIONS) {
        return false
      }
      if (segment === 'new' && !isNewCompanyClient(client)) {
        return false
      }
      if (!query) {
        return true
      }
      return (
        client.name.toLowerCase().includes(query)
        || client.email.toLowerCase().includes(query)
        || client.phone.toLowerCase().includes(query)
      )
    })
  }, [clients, searchQuery, segment])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  )

  useEffect(() => {
    if (!selectedClient?.email) {
      setReservations([])
      return
    }
    let cancelled = false
    void getReservationsByCompany(companyId, {
      clientEmail: selectedClient.email,
      limitCount: COMPANY_CLIENT_RESERVATION_LIMIT,
    }).then((rows) => {
      if (!cancelled) {
        setReservations(rows)
      }
    }).catch(() => {
      if (!cancelled) {
        setReservations([])
      }
    })
    return () => {
      cancelled = true
    }
  }, [companyId, selectedClient?.email])

  const clientReservations = useMemo(() => {
    return [...reservations].sort((left, right) => right.startTime.getTime() - left.startTime.getTime())
  }, [reservations])

  const reservationDateOptions = useMemo(() => {
    const dates = new Set(clientReservations.map((reservation) => dateToIsoDate(reservation.startTime)))
    return [...dates].sort((a, b) => b.localeCompare(a))
  }, [clientReservations])

  const reservationTimeOptions = useMemo(() => {
    const times = new Set(
      clientReservations
        .filter((reservation) => !reservationDateFilter || dateToIsoDate(reservation.startTime) === reservationDateFilter)
        .map((reservation) => dateToTimeInput(reservation.startTime)),
    )
    return [...times].sort()
  }, [clientReservations, reservationDateFilter])

  const reservationTableOptions = useMemo(() => {
    const tableIds = new Set(
      clientReservations
        .filter((reservation) => {
          if (reservationDateFilter && dateToIsoDate(reservation.startTime) !== reservationDateFilter) {
            return false
          }

          if (reservationTimeFilter && dateToTimeInput(reservation.startTime) !== reservationTimeFilter) {
            return false
          }

          return true
        })
        .map((reservation) => reservation.tableId),
    )

    return [...tableIds]
      .map((tableId) => ({
        id: tableId,
        name: tableMeta[tableId]?.name ?? 'Mesa',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [clientReservations, reservationDateFilter, reservationTimeFilter, tableMeta])

  const filteredClientReservations = useMemo(() => {
    return clientReservations.filter((reservation) => {
      if (reservationDateFilter && dateToIsoDate(reservation.startTime) !== reservationDateFilter) {
        return false
      }

      if (reservationTimeFilter && dateToTimeInput(reservation.startTime) !== reservationTimeFilter) {
        return false
      }

      if (reservationTableFilter && reservation.tableId !== reservationTableFilter) {
        return false
      }

      return true
    })
  }, [clientReservations, reservationDateFilter, reservationTimeFilter, reservationTableFilter])

  const hasReservationFilters = Boolean(
    reservationDateFilter || reservationTimeFilter || reservationTableFilter,
  )

  const clearReservationFilters = () => {
    setReservationDateFilter('')
    setReservationTimeFilter('')
    setReservationTableFilter('')
  }

  const now = Date.now()
  const stats = (() => {
    const visits = clientReservations.filter((row) => row.status === 'confirmed')
    const upcoming = clientReservations
      .filter((row) => row.status !== 'cancelled' && row.startTime.getTime() > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    return {
      total: clientReservations.length,
      visits: visits.length,
      cancelled: clientReservations.filter((row) => row.status === 'cancelled' && !row.noShow).length,
      noShows: clientReservations.filter((row) => row.noShow === true).length,
      lastVisit: visits[0]?.startTime ?? null,
      next: upcoming[0]?.startTime ?? null,
    }
  })()

  // Hábitos del cliente, sacados de sus reservas no canceladas.
  const habits = (() => {
    const kept = clientReservations.filter((row) => row.status !== 'cancelled')
    if (kept.length === 0) {
      return null
    }
    const table = mostFrequent(kept.map((row) => row.tableId).filter(Boolean))
    const hour = mostFrequent(kept.map((row) => formatTimeSpanish(row.startTime)))
    const weekday = mostFrequent(kept.map((row) => row.startTime.getDay()))
    const averagePax = kept.reduce((sum, row) => sum + (row.pax || 0), 0) / kept.length
    return {
      table: table ? { name: tableMeta[table.value]?.name ?? 'Mesa', count: table.count } : null,
      hour,
      weekday: weekday ? { name: WEEKDAYS[weekday.value], count: weekday.count } : null,
      averagePax,
      total: kept.length,
    }
  })()

  if (isLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loadingState}>Cargando clientes…</div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Clientes</h2>
          <p className={styles.subtitle}>
            {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
            {clientsCursor ? ' (hay más)' : ''} · quien ha reservado en tu local
          </p>
        </div>
        <div className={styles.searchRow}>
          <label className={styles.search}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Buscar nombre, correo o teléfono"
              aria-label="Buscar cliente"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadData(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {error && <div className={styles.errorState}>{error}</div>}

      <div className={styles.layout}>
        <section className={styles.listPanel} aria-label="Lista de clientes">
          <div className={styles.segmented} role="group" aria-label="Filtrar clientes">
            {([
              ['all', 'Todos'],
              ['regular', 'Habituales'],
              ['new', 'Nuevos'],
            ] as [ClientSegment, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`${styles.segmentedButton} ${segment === id ? styles.segmentedButtonOn : ''}`}
                aria-pressed={segment === id}
                onClick={() => setSegment(id)}
                title={
                  id === 'regular'
                    ? `${REGULAR_MIN_RESERVATIONS} reservas o más`
                    : id === 'new'
                      ? 'Primera reserva en los últimos 30 días'
                      : undefined
                }
              >
                {label}
                <span className={styles.segmentedCount}>{segmentCounts[id]}</span>
              </button>
            ))}
          </div>
          {filteredClients.length === 0 ? (
            <div className={styles.emptyState}>
              {clients.length === 0
                ? 'Aún no hay clientes. Aparecerán cuando reserven con su correo.'
                : searchQuery.trim()
                  ? 'Ningún cliente coincide con la búsqueda.'
                  : segment === 'regular'
                    ? `Aún no hay clientes con ${REGULAR_MIN_RESERVATIONS} reservas o más.`
                    : 'No hay clientes nuevos en los últimos 30 días.'}
            </div>
          ) : (
            <ul className={styles.clientList}>
              {filteredClients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className={`${styles.clientItem} ${selectedClientId === client.id ? styles.clientItemActive : ''}`}
                    aria-pressed={selectedClientId === client.id}
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <span className={styles.avatar} aria-hidden="true">{initials(client.name)}</span>
                    <span className={styles.clientText}>
                      <span className={styles.clientNameRow}>
                        <span className={styles.clientName} title={client.name}>{client.name}</span>
                        {isNewCompanyClient(client) ? <span className={styles.badgeNew}>Nuevo</span> : null}
                      </span>
                      <span className={styles.clientMeta} title={client.email}>{client.email}</span>
                    </span>
                    <span className={styles.clientSide}>
                      <span className={styles.clientCount} aria-label={`${client.reservationCount} reservas`}>
                        {client.reservationCount}
                      </span>
                      <span className={styles.clientLast} title={`Última reserva: ${shortDate(client.lastReservationDate)}`}>
                        {relativeDay(client.lastReservationDate)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {clientsCursor ? (
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={() => void loadMoreClients()}
              disabled={loadingMore}
            >
              {loadingMore ? 'Cargando…' : 'Cargar más clientes'}
            </button>
          ) : null}
          <footer className={styles.listFooter}>
            <span>
              <strong>{filteredClients.length}</strong> de {clients.length}
              {clientsCursor ? '+' : ''}
            </span>
            <span>
              <strong>{segmentCounts.new}</strong> nuevos este mes · <strong>{segmentCounts.regular}</strong>{' '}
              habituales
            </span>
          </footer>
        </section>

        <section className={styles.detailPanel} aria-label="Ficha del cliente">
          {!selectedClient ? (
            <div className={styles.detailEmpty}>Selecciona un cliente de la lista.</div>
          ) : (
            <>
              <div className={styles.profile}>
                <span className={styles.profileAvatar} aria-hidden="true">{initials(selectedClient.name)}</span>
                <div className={styles.profileMain}>
                  <div className={styles.profileNameRow}>
                    <h3 className={styles.profileName}>{selectedClient.name}</h3>
                    {isNewCompanyClient(selectedClient) ? (
                      <span className={styles.badgeNew}>Nuevo</span>
                    ) : stats.visits >= 3 ? (
                      <span className={styles.badgeRegular}>Habitual</span>
                    ) : null}
                  </div>
                  <div className={styles.contact}>
                    {selectedClient.email ? <a href={`mailto:${selectedClient.email}`}>{selectedClient.email}</a> : null}
                    {selectedClient.phone ? (
                      <a href={`tel:${selectedClient.phone.replace(/\s+/g, '')}`}>{selectedClient.phone}</a>
                    ) : (
                      <span>Sin teléfono</span>
                    )}
                    <span>Cliente desde {formatDateSpanish(selectedClient.firstReservationDate)}</span>
                  </div>
                </div>
                <div className={styles.profileActions}>
                  {selectedClient.email ? (
                    <a className={styles.actionButton} href={`mailto:${selectedClient.email}`}>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="m3 7 9 6 9-6" />
                      </svg>
                      Correo
                    </a>
                  ) : null}
                  {selectedClient.phone ? (
                    <a className={styles.actionButton} href={`tel:${selectedClient.phone.replace(/\s+/g, '')}`}>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
                      </svg>
                      Llamar
                    </a>
                  ) : null}
                </div>
              </div>

              <dl className={styles.stats}>
                <div className={styles.stat}>
                  <dt>Reservas</dt>
                  <dd>{stats.total}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>Vino</dt>
                  <dd>{stats.visits}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>Canceladas</dt>
                  <dd>{stats.cancelled}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>Faltas</dt>
                  <dd className={stats.noShows > 0 ? styles.statDanger : ''}>{stats.noShows}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>Última visita</dt>
                  <dd className={styles.statDate}>{stats.lastVisit ? shortDate(stats.lastVisit) : '—'}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>Próxima reserva</dt>
                  <dd className={styles.statDate}>{stats.next ? shortDate(stats.next) : '—'}</dd>
                </div>
              </dl>

              {habits ? (
                <div className={styles.habits}>
                  <h4 className={styles.habitsTitle}>Hábitos</h4>
                  <div className={styles.habitList}>
                    <div className={styles.habit}>
                      <span className={styles.habitLabel}>Mesa favorita</span>
                      <span className={styles.habitValue}>{habits.table?.name ?? '—'}</span>
                      {habits.table ? (
                        <span className={styles.habitHint}>
                          {habits.table.count} de {habits.total} {habits.total === 1 ? 'vez' : 'veces'}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.habit}>
                      <span className={styles.habitLabel}>Hora habitual</span>
                      <span className={styles.habitValue}>{habits.hour?.value ?? '—'}</span>
                      {habits.hour ? (
                        <span className={styles.habitHint}>
                          {habits.hour.count} de {habits.total} {habits.total === 1 ? 'vez' : 'veces'}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.habit}>
                      <span className={styles.habitLabel}>Día preferido</span>
                      <span className={`${styles.habitValue} ${styles.capitalize}`}>{habits.weekday?.name ?? '—'}</span>
                      {habits.weekday ? (
                        <span className={styles.habitHint}>
                          {habits.weekday.count} de {habits.total} {habits.total === 1 ? 'vez' : 'veces'}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.habit}>
                      <span className={styles.habitLabel}>Viene con</span>
                      <span className={styles.habitValue}>
                        {habits.averagePax.toLocaleString('es-ES', { maximumFractionDigits: 1 })}{' '}
                        {Math.round(habits.averagePax) === 1 ? 'persona' : 'personas'}
                      </span>
                      <span className={styles.habitHint}>de media por reserva</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={styles.historyHead}>
                <h4 className={styles.historyTitle}>
                  Historial
                  <span className={styles.historyCount}>
                    {hasReservationFilters
                      ? `${filteredClientReservations.length} de ${clientReservations.length}`
                      : clientReservations.length}
                  </span>
                </h4>
                {clientReservations.length > 0 && (
                  <div className={styles.reservationFilters}>
                    <ClientReservationDatePicker
                      value={reservationDateFilter}
                      onChange={(isoDate) => {
                        setReservationDateFilter(isoDate)
                        setReservationTimeFilter('')
                        setReservationTableFilter('')
                      }}
                      reservations={clientReservations}
                      availableDates={reservationDateOptions}
                    />
                    <label className={styles.filterField}>
                      <span>Hora</span>
                      <select
                        value={reservationTimeFilter}
                        onChange={(event) => {
                          setReservationTimeFilter(event.target.value)
                          setReservationTableFilter('')
                        }}
                      >
                        <option value="">Todas</option>
                        {reservationTimeOptions.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.filterField}>
                      <span>Mesa</span>
                      <select
                        value={reservationTableFilter}
                        onChange={(event) => setReservationTableFilter(event.target.value)}
                      >
                        <option value="">Todas</option>
                        {reservationTableOptions.map((table) => (
                          <option key={table.id} value={table.id}>{table.name}</option>
                        ))}
                      </select>
                    </label>
                    {hasReservationFilters && (
                      <button type="button" className={styles.filterClearButton} onClick={clearReservationFilters}>
                        Limpiar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {clientReservations.length === 0 ? (
                <div className={styles.detailEmpty}>Este cliente aún no tiene reservas con su correo.</div>
              ) : filteredClientReservations.length === 0 ? (
                <div className={styles.detailEmpty}>Ninguna reserva coincide con los filtros.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Hora</th>
                        <th scope="col">Mesa</th>
                        <th scope="col">Pers.</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientReservations.map((reservation) => {
                        const status = reservationStatus(reservation, now)
                        return (
                          <tr key={reservation.id}>
                            <td className={styles.nowrap}>{shortDate(reservation.startTime)}</td>
                            <td className={styles.nowrap}>{formatTimeSpanish(reservation.startTime)}</td>
                            <td className={styles.nowrap}>{tableMeta[reservation.tableId]?.name ?? '—'}</td>
                            <td>{reservation.pax}</td>
                            <td><span className={`${styles.status} ${status.className}`}>{status.label}</span></td>
                            <td className={styles.notes}>{reservation.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <footer className={styles.legalFooter}>
        Uso permitido para gestionar reservas del local. Informa a tus clientes en tu política de
        privacidad.{' '}
        <a href="/legal/aviso-legal" target="_blank" rel="noreferrer">Aviso legal</a>
        {' · '}
        <a href="/legal/privacidad" target="_blank" rel="noreferrer">Privacidad</a>
        {' · '}
        <a href="/legal/terminos" target="_blank" rel="noreferrer">Términos</a>
        {' · '}
        <a href="/legal/cookies" target="_blank" rel="noreferrer">Cookies</a>
      </footer>
    </div>
  )
}

export default CompanyClients
