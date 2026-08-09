import { useCallback, useEffect, useMemo, useState } from 'react'
import ClientReservationDatePicker from '../../components/ClientReservationDatePicker'
import {
  filterReservationsByClientEmail,
  getCompanyClients,
  isNewCompanyClient,
} from '../../services/companyClients'
import { getFirestoreErrorMessage, getReservationsByCompany, getTablesByCompany, tablesToMeta } from '../../services/firestore'
import type { CompanyClient, Reservation } from '../../types'
import { dateToIsoDate, dateToTimeInput, formatDateSpanish, formatTimeSpanish } from '../../utils/helpers'
import styles from './CompanyClients.module.css'

interface CompanyClientsProps {
  companyId: string
}

const STATUS_LABELS: Record<Reservation['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  completed: 'Pendiente',
}

const STATUS_CLASS: Record<Reservation['status'], string> = {
  confirmed: styles.statusConfirmed,
  cancelled: styles.statusCancelled,
  completed: styles.statusCompleted,
}

function CompanyClients({ companyId }: CompanyClientsProps) {
  const [clients, setClients] = useState<CompanyClient[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tableMeta, setTableMeta] = useState<Record<string, { name: string; capacity: number }>>({})
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [reservationDateFilter, setReservationDateFilter] = useState('')
  const [reservationTimeFilter, setReservationTimeFilter] = useState('')
  const [reservationTableFilter, setReservationTableFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    setError(null)

    try {
      const [clientRows, reservationRows, tableRows] = await Promise.all([
        getCompanyClients(companyId),
        getReservationsByCompany(companyId),
        getTablesByCompany(companyId),
      ])

      setClients(clientRows)
      setReservations(reservationRows)
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

  useEffect(() => {
    setReservationDateFilter('')
    setReservationTimeFilter('')
    setReservationTableFilter('')
  }, [selectedClientId])

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return clients
    }

    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(query)
        || client.email.toLowerCase().includes(query)
        || client.phone.toLowerCase().includes(query)
      )
    })
  }, [clients, searchQuery])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  )

  const clientReservations = useMemo(() => {
    if (!selectedClient) {
      return []
    }

    return filterReservationsByClientEmail(reservations, selectedClient.email)
  }, [reservations, selectedClient])

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
        <h2>Clientes</h2>
        <div className={styles.searchRow}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar nombre, correo o teléfono…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
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
        <section className={styles.panel} aria-label="Lista de clientes">
          <div className={styles.panelHeader}>
            <h3>Lista</h3>
          </div>
          <div className={styles.panelBody}>
            {filteredClients.length === 0 ? (
              <div className={styles.emptyState}>
                {clients.length === 0
                  ? 'Aún no hay clientes registrados. Aparecerán al crear reservas con correo.'
                  : 'Ningún cliente coincide con la búsqueda.'}
              </div>
            ) : (
              <ul className={styles.clientList}>
                {filteredClients.map((client) => (
                  <li key={client.id}>
                    <button
                      type="button"
                      className={`${styles.clientItem} ${
                        selectedClientId === client.id ? styles.clientItemActive : ''
                      }`}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <div className={styles.clientNameRow}>
                        <span className={styles.clientName} title={client.name}>
                          {client.name}
                        </span>
                        <span className={styles.clientCount}>
                          {client.reservationCount}
                        </span>
                      </div>
                      <div className={styles.clientSubRow}>
                        <span className={styles.clientMeta} title={client.email}>
                          {client.email}
                        </span>
                        {isNewCompanyClient(client) && (
                          <span className={styles.clientBadge}>Nuevo</span>
                        )}
                      </div>
                      {client.phone && (
                        <span className={styles.clientPhone} title={client.phone}>
                          {client.phone}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.panel} aria-label="Reservas del cliente">
          <div className={styles.panelHeader}>
            <h3>Reservas del cliente</h3>
          </div>

          {!selectedClient ? (
            <div className={styles.panelBody}>
              <div className={styles.detailEmpty}>Selecciona un cliente de la lista.</div>
            </div>
          ) : (
            <>
              <div className={styles.detailSummary}>
                <span>
                  <strong>{selectedClient.name}</strong>
                </span>
                <span>{selectedClient.email}</span>
                <span>{selectedClient.phone || 'Sin teléfono'}</span>
                <span>
                  Cliente desde {formatDateSpanish(selectedClient.firstReservationDate)}
                </span>
                <span>
                  {hasReservationFilters
                    ? `${filteredClientReservations.length} de ${clientReservations.length} reserva(s)`
                    : `${clientReservations.length} reserva(s) en total`}
                </span>
              </div>

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
                        <option key={time} value={time}>
                          {time}
                        </option>
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
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {hasReservationFilters && (
                    <button
                      type="button"
                      className={styles.filterClearButton}
                      onClick={clearReservationFilters}
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              )}

              <div className={styles.panelBody}>
                {clientReservations.length === 0 ? (
                  <div className={styles.detailEmpty}>
                    Este cliente aún no tiene reservas registradas con correo.
                  </div>
                ) : filteredClientReservations.length === 0 ? (
                  <div className={styles.detailEmpty}>
                    Ninguna reserva coincide con los filtros seleccionados.
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>Mesa</th>
                          <th>Pax</th>
                          <th>Estado</th>
                          <th>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClientReservations.map((reservation) => (
                          <tr key={reservation.id}>
                            <td>{formatDateSpanish(reservation.startTime)}</td>
                            <td>{formatTimeSpanish(reservation.startTime)}</td>
                            <td>{tableMeta[reservation.tableId]?.name ?? '—'}</td>
                            <td>{reservation.pax}</td>
                            <td className={STATUS_CLASS[reservation.status]}>
                              {STATUS_LABELS[reservation.status]}
                            </td>
                            <td>{reservation.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <footer className={styles.legalFooter}>
        Uso permitido para gestionar reservas del local. Informa a tus clientes en tu política de
        privacidad.{' '}
        <a href="/legal/privacidad" target="_blank" rel="noreferrer">
          Ver política Adelia
        </a>
      </footer>
    </div>
  )
}

export default CompanyClients
