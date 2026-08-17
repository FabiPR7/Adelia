import { useEffect, useState } from 'react'
import { fetchCompanyRanking } from '../../services/companyGamification'
import type { CompanyRankingEntry } from '../../types/companyGamification'
import { ADELIA_LOGO_URL } from '../../constants/brand'
import styles from './CompanyCompiteRanking.module.css'

type RankingScope = 'local' | 'world'

function RankRow({ entry }: { entry: CompanyRankingEntry }) {
  return (
    <article className={`${styles.row} ${entry.isYou ? styles.rowYou : ''}`}>
      <strong className={styles.rank}>#{entry.rank}</strong>
      <img src={entry.logoUrl || ADELIA_LOGO_URL} alt="" className={styles.logo} />
      <div className={styles.meta}>
        <strong>{entry.isYou ? `${entry.name} (tú)` : entry.name}</strong>
        <span>
          {entry.municipality || entry.country || '—'} · Nv. {entry.level} {entry.levelTitle}
        </span>
      </div>
      <div className={styles.scores}>
        <b>{entry.xp.toLocaleString('es-ES')} XP</b>
        <span>{entry.reviewAdelinas} Adelinas</span>
      </div>
    </article>
  )
}

export default function CompanyCompiteRanking() {
  const [scope, setScope] = useState<RankingScope>('local')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState<CompanyRankingEntry[]>([])
  const [world, setWorld] = useState<CompanyRankingEntry[]>([])
  const [localRank, setLocalRank] = useState(1)
  const [worldRank, setWorldRank] = useState(1)
  const [municipality, setMunicipality] = useState('')
  const [country, setCountry] = useState('España')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchCompanyRanking()
      .then((payload) => {
        if (cancelled) return
        setLocal(payload.local)
        setWorld(payload.world)
        setLocalRank(payload.localRank)
        setWorldRank(payload.worldRank)
        setMunicipality(payload.municipality)
        setCountry(payload.country)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el ranking.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const entries = scope === 'local' ? local : world
  const rank = scope === 'local' ? localRank : worldRank

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Compite</p>
        <h1>Ranking</h1>
        <p className={styles.lead}>
          Ordenado por XP de casa. El local usa {municipality || country}; el mundial incluye todos los restaurantes de Adelia.
        </p>
      </header>

      <div className={styles.scopeTabs} role="tablist" aria-label="Alcance del ranking">
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'local'}
          className={scope === 'local' ? styles.scopeTabActive : styles.scopeTab}
          onClick={() => setScope('local')}
        >
          Local
          <span>{municipality || country}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'world'}
          className={scope === 'world' ? styles.scopeTabActive : styles.scopeTab}
          onClick={() => setScope('world')}
        >
          Mundial
          <span>Adelia</span>
        </button>
      </div>

      <p className={styles.yourRank}>
        Tu puesto {scope === 'local' ? 'local' : 'mundial'}: <strong>#{rank}</strong>
      </p>

      {loading ? (
        <div className={styles.empty}>Cargando clasificación…</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          Aún no hay suficientes restaurantes en este ranking. Completa misiones para aparecer el primero.
        </div>
      ) : (
        <div className={styles.list}>
          {entries.map((entry) => (
            <RankRow key={entry.companyId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
