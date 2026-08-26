import { useMemo, useState } from 'react'
import type { AdminCustomerRow, AdminMissionRow } from '../../types/adminOps'
import styles from './AdminOpsBoard.module.css'

interface AdminPlayBoardProps {
  missions: AdminMissionRow[]
  customers: AdminCustomerRow[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  onSaveMission: (mission: AdminMissionRow) => Promise<void>
}

function AdminPlayBoard({
  missions,
  customers,
  isLoading,
  isSaving,
  error,
  onSaveMission,
}: AdminPlayBoardProps) {
  const [drafts, setDrafts] = useState<Record<string, AdminMissionRow>>({})

  const topAdelinas = useMemo(() => {
    return [...customers]
      .sort((left, right) => right.adelinas - left.adelinas || right.xp - left.xp)
      .slice(0, 8)
  }, [customers])

  const missionValue = (mission: AdminMissionRow) => drafts[mission.id] ?? mission

  return (
    <div className={styles.wrap}>
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.kpis}>
        <article>
          <strong>{missions.length}</strong>
          <span>Misiones</span>
        </article>
        <article>
          <strong>{customers.filter((customer) => customer.adelinas >= 500).length}</strong>
          <span>Con 500+ Adelinás</span>
        </article>
        <article>
          <strong>{topAdelinas[0]?.adelinas ?? 0}</strong>
          <span>Máximo Adelinás</span>
        </article>
        <article>
          <strong>{topAdelinas[0]?.xp ?? 0}</strong>
          <span>Máximo XP</span>
        </article>
      </div>

      <section className={styles.panel}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Posibles picos</th>
              <th>Adelinás</th>
              <th>XP</th>
              <th>Reservas</th>
            </tr>
          </thead>
          <tbody>
            {topAdelinas.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>Aún no hay comensales con juego.</td>
              </tr>
            ) : topAdelinas.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <strong>{customer.displayName}</strong>
                  <em>{customer.email}</em>
                </td>
                <td>{customer.adelinas}</td>
                <td>{customer.xp}</td>
                <td>{customer.reservationCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isLoading ? (
        <p className={styles.empty}>Cargando catálogo…</p>
      ) : (
        <div className={styles.cards}>
          {missions.map((mission) => {
            const draft = missionValue(mission)
            return (
              <article key={mission.id} className={styles.card}>
                <h3>{draft.icon} {draft.name}</h3>
                <p className={styles.muted}>{mission.cadence}{mission.category ? ` · ${mission.category}` : ''}</p>
                <label className={styles.field}>
                  Nombre
                  <input
                    value={draft.name}
                    onChange={(event) => setDrafts({ ...drafts, [mission.id]: { ...draft, name: event.target.value } })}
                  />
                </label>
                <label className={styles.field}>
                  Qué hay que hacer
                  <textarea
                    rows={2}
                    value={draft.description}
                    onChange={(event) => setDrafts({ ...drafts, [mission.id]: { ...draft, description: event.target.value } })}
                  />
                </label>
                <div className={styles.row}>
                  <label className={styles.field}>
                    XP
                    <input
                      type="number"
                      min={0}
                      value={draft.xp}
                      onChange={(event) => setDrafts({ ...drafts, [mission.id]: { ...draft, xp: Number(event.target.value) } })}
                    />
                  </label>
                  <label className={styles.field}>
                    Objetivo
                    <input
                      type="number"
                      min={1}
                      value={draft.target}
                      onChange={(event) => setDrafts({ ...drafts, [mission.id]: { ...draft, target: Number(event.target.value) } })}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={isSaving}
                  onClick={() => void onSaveMission(draft)}
                >
                  Guardar misión
                </button>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AdminPlayBoard
