import {
  INVENTORY_ITEMS,
  LEVEL_REWARDS,
  LOOT_BANDS,
  LOOT_POOLS,
  REVIEW_BOOST_ADELINAS,
  REVIEW_BOOST_XP,
  WALK_IN_COOLDOWN_HOURS,
  lootDifficultyLabel,
  type InventoryGrant,
  type LootBand,
  type MissionLootDifficulty,
} from '../../../data/inventoryItems'
import { CANCELLATION_PENALTY_RATES, PROMO_LOCK_STRIKES } from '../../../data/cancellationPenalties'
import { savePenaltyConfig, saveRewardsConfig } from '../../../services/adminCatalog'
import styles from '../AdminCatalog.module.css'
import { Card, Field, NumberInput, SaveBar, Select, useDraft, useSave } from './CatalogUi'

type PoolDifficulty = Exclude<MissionLootDifficulty, 'none'>
const POOL_DIFFICULTIES: PoolDifficulty[] = ['easy', 'medium', 'hard', 'legendary']
const BAND_CADENCES: Array<{ key: string; label: string }> = [
  { key: 'weekly', label: 'Misiones semanales' },
  { key: 'monthly', label: 'Misiones mensuales' },
  { key: 'historical', label: 'Logros (históricas)' },
]
const DIFFICULTY_OPTIONS = (['none', ...POOL_DIFFICULTIES] as MissionLootDifficulty[]).map((value) => ({
  value,
  label: lootDifficultyLabel(value),
}))

interface RewardsDraft {
  levelRewards: Record<number, InventoryGrant[]>
  lootPools: Record<PoolDifficulty, string[]>
  lootBands: Record<string, LootBand[]>
  reviewBoostXp: number
  reviewBoostAdelinas: number
  walkInCooldownHours: number
}

function initialRewards(): RewardsDraft {
  return {
    levelRewards: structuredClone(LEVEL_REWARDS),
    lootPools: {
      easy: [...(LOOT_POOLS.easy ?? [])],
      medium: [...(LOOT_POOLS.medium ?? [])],
      hard: [...(LOOT_POOLS.hard ?? [])],
      legendary: [...(LOOT_POOLS.legendary ?? [])],
    },
    lootBands: structuredClone(LOOT_BANDS),
    reviewBoostXp: REVIEW_BOOST_XP,
    reviewBoostAdelinas: REVIEW_BOOST_ADELINAS,
    walkInCooldownHours: WALK_IN_COOLDOWN_HOURS,
  }
}

function validateRewards(draft: RewardsDraft): string | null {
  const known = new Set(INVENTORY_ITEMS.map((item) => item.id))
  for (const [level, grants] of Object.entries(draft.levelRewards)) {
    for (const grant of grants) {
      if (!known.has(grant.itemId)) return `Nivel ${level}: el ítem "${grant.itemId}" no existe.`
      if (!Number.isFinite(grant.quantity) || grant.quantity < 1) return `Nivel ${level}: la cantidad debe ser 1 o más.`
    }
  }
  for (const difficulty of POOL_DIFFICULTIES) {
    if (draft.lootPools[difficulty].length === 0) {
      return `El premio "${lootDifficultyLabel(difficulty)}" necesita al menos un ítem.`
    }
  }
  for (const { key, label } of BAND_CADENCES) {
    const bands = draft.lootBands[key] ?? []
    if (bands.length === 0) return `${label}: define al menos una banda.`
    if (bands[bands.length - 1].below !== undefined) return `${label}: la última banda debe ser "el resto" (sin límite de XP).`
    const limits = bands.slice(0, -1).map((band) => band.below ?? Number.NaN)
    if (limits.some((limit) => !Number.isFinite(limit))) return `${label}: falta el límite de XP de una banda.`
    if (limits.some((limit, index) => index > 0 && limit <= limits[index - 1])) return `${label}: los límites deben ir de menor a mayor.`
  }
  if (!Number.isFinite(draft.reviewBoostXp) || draft.reviewBoostXp < 0) return 'La Nota del crítico necesita XP válida.'
  if (!Number.isFinite(draft.reviewBoostAdelinas) || draft.reviewBoostAdelinas < 0) return 'La Nota del crítico necesita Adelinas válidas.'
  if (!Number.isFinite(draft.walkInCooldownHours) || draft.walkInCooldownHours < 0) return 'La espera entre consumos no es válida.'
  return null
}

const itemOptions = () => INVENTORY_ITEMS.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` }))

export function CatalogRewards() {
  const { draft, setDraft, dirty, markSaved, reset } = useDraft(initialRewards)
  const { status, message, run, clear } = useSave('Recompensas')

  const change = (update: (current: RewardsDraft) => RewardsDraft) => {
    clear()
    setDraft(update)
  }

  const levels = Object.keys(draft.levelRewards).map(Number).sort((left, right) => left - right)
  const nextLevel = (levels[levels.length - 1] ?? 1) + 1

  const setGrants = (level: number, grants: InventoryGrant[]) =>
    change((current) => ({ ...current, levelRewards: { ...current.levelRewards, [level]: grants } }))

  const togglePool = (difficulty: PoolDifficulty, itemId: string) =>
    change((current) => {
      const pool = current.lootPools[difficulty]
      return {
        ...current,
        lootPools: {
          ...current.lootPools,
          [difficulty]: pool.includes(itemId) ? pool.filter((id) => id !== itemId) : [...pool, itemId],
        },
      }
    })

  const setBands = (cadence: string, bands: LootBand[]) =>
    change((current) => ({ ...current, lootBands: { ...current.lootBands, [cadence]: bands } }))

  const save = () => {
    void run(async () => {
      await saveRewardsConfig({
        levelRewards: draft.levelRewards,
        lootPools: draft.lootPools,
        lootBands: draft.lootBands,
        reviewBoostXp: draft.reviewBoostXp,
        reviewBoostAdelinas: draft.reviewBoostAdelinas,
        walkInCooldownHours: draft.walkInCooldownHours,
      })
      markSaved()
    }, () => validateRewards(draft))
  }

  return (
    <>
      <Card title="Premio al subir de nivel" hint="Ítems que recibe el comensal al llegar a cada nivel.">
        <div className={styles.rows}>
          {levels.map((level) => (
            <div key={level} className={styles.card}>
              <div className={styles.cardHead}><h3>Nivel {level}</h3></div>
              <div className={styles.rows}>
                {draft.levelRewards[level].map((grant, index) => (
                  <div key={index} className={styles.rowLine}>
                    <Select
                      value={grant.itemId}
                      options={itemOptions()}
                      onChange={(itemId) => setGrants(level, draft.levelRewards[level].map((entry, at) => (at === index ? { ...entry, itemId } : entry)))}
                    />
                    <NumberInput
                      value={grant.quantity}
                      min={1}
                      onChange={(quantity) => setGrants(level, draft.levelRewards[level].map((entry, at) => (at === index ? { ...entry, quantity } : entry)))}
                    />
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
                      aria-label="Quitar ítem"
                      onClick={() => setGrants(level, draft.levelRewards[level].filter((_, at) => at !== index))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className={styles.chips}>
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => setGrants(level, [...draft.levelRewards[level], { itemId: INVENTORY_ITEMS[0]?.id ?? '', quantity: 1 }])}
                  >
                    + Añadir ítem
                  </button>
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => change((current) => {
                      const { [level]: _removed, ...rest } = current.levelRewards
                      return { ...current, levelRewards: rest }
                    })}
                  >
                    Quitar premio del nivel
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className={styles.chips}>
            <button type="button" className={styles.chip} onClick={() => setGrants(nextLevel, [{ itemId: INVENTORY_ITEMS[0]?.id ?? '', quantity: 1 }])}>
              + Premio para el nivel {nextLevel}
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="Premios de misiones y packs"
        hint="Según lo difícil que sea una misión, se sortea un ítem de la lista de su dificultad. Los packs semanales y mensuales usan fácil, medio y útil."
      >
        {POOL_DIFFICULTIES.map((difficulty) => (
          <div key={difficulty} className={styles.rows}>
            <strong>{lootDifficultyLabel(difficulty)}</strong>
            <div className={styles.chips}>
              {INVENTORY_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={draft.lootPools[difficulty].includes(item.id)}
                  className={`${styles.chip} ${draft.lootPools[difficulty].includes(item.id) ? styles.chipOn : ''}`}
                  onClick={() => togglePool(difficulty, item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card
        title="Qué misión da qué premio"
        hint="Por XP de la misión: hasta el límite indicado cuenta la dificultad de esa fila; la última fila es para todo lo que quede por encima."
      >
        {BAND_CADENCES.map(({ key, label }) => {
          const bands = draft.lootBands[key] ?? []
          return (
            <div key={key} className={styles.rows}>
              <strong>{label}</strong>
              {bands.map((band, index) => {
                const isLast = index === bands.length - 1
                return (
                  <div key={index} className={styles.bandLine}>
                    {isLast ? (
                      <span className={styles.saveMsg}>El resto</span>
                    ) : (
                      <NumberInput
                        value={band.below ?? Number.NaN}
                        min={1}
                        onChange={(below) => setBands(key, bands.map((entry, at) => (at === index ? { ...entry, below } : entry)))}
                      />
                    )}
                    <Select
                      value={band.difficulty}
                      options={DIFFICULTY_OPTIONS}
                      onChange={(difficulty) => setBands(key, bands.map((entry, at) => (at === index ? { ...entry, difficulty } : entry)))}
                    />
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
                      aria-label="Quitar banda"
                      disabled={bands.length <= 1}
                      onClick={() => {
                        const next = bands.filter((_, at) => at !== index)
                        // La última banda nunca lleva límite.
                        const last = next.length - 1
                        setBands(key, next.map((entry, at) => (at === last ? { difficulty: entry.difficulty } : entry)))
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
              <div className={styles.chips}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => {
                    const last = bands[bands.length - 1]
                    const previous = bands.slice(0, -1)
                    const limit = (previous[previous.length - 1]?.below ?? 0) + 100
                    setBands(key, [...previous, { below: limit, difficulty: last?.difficulty ?? 'easy' }, { difficulty: last?.difficulty ?? 'easy' }])
                  }}
                >
                  + Añadir banda
                </button>
              </div>
            </div>
          )
        })}
      </Card>

      <Card title="Nota del crítico" hint="Lo que suma la próxima reseña cuando el comensal gasta una Nota del crítico.">
        <div className={styles.grid2}>
          <Field label="XP extra"><NumberInput value={draft.reviewBoostXp} min={0} onChange={(reviewBoostXp) => change((current) => ({ ...current, reviewBoostXp }))} /></Field>
          <Field label="Adelinas extra"><NumberInput value={draft.reviewBoostAdelinas} min={0} onChange={(reviewBoostAdelinas) => change((current) => ({ ...current, reviewBoostAdelinas }))} /></Field>
        </div>
      </Card>

      <Card title="Consumos sin reserva" hint="Quien registra un consumo con el PIN del restaurante suma una visita al mapa. Para que no se pueda repetir sin ir al local, hay que esperar este tiempo entre consumos del mismo restaurante.">
        <div className={styles.grid2}>
          <Field label="Horas de espera" hint="0 = sin espera">
            <NumberInput value={draft.walkInCooldownHours} min={0} onChange={(walkInCooldownHours) => change((current) => ({ ...current, walkInCooldownHours }))} />
          </Field>
        </div>
      </Card>

      <SaveBar dirty={dirty} status={status} message={message} onSave={save} onReset={() => { reset(); clear() }} />
    </>
  )
}

interface PenaltyDraft {
  rates: Array<{ strike: number; percent: number; minXp: number }>
  lockStrikes: number
}

function initialPenalties(): PenaltyDraft {
  return { rates: CANCELLATION_PENALTY_RATES.map((rate) => ({ ...rate })), lockStrikes: PROMO_LOCK_STRIKES }
}

function validatePenalties(draft: PenaltyDraft): string | null {
  if (draft.rates.length === 0) return 'Define al menos un aviso.'
  for (const rate of draft.rates) {
    if (!Number.isFinite(rate.percent) || rate.percent < 0 || rate.percent > 100) return `Aviso ${rate.strike}: el porcentaje va de 0 a 100.`
    if (!Number.isFinite(rate.minXp) || rate.minXp < 0) return `Aviso ${rate.strike}: el mínimo de XP no puede ser negativo.`
  }
  if (!Number.isFinite(draft.lockStrikes) || draft.lockStrikes < 1) return 'El bloqueo de promos empieza en el aviso 1 o más.'
  return null
}

export function CatalogPenalties() {
  const { draft, setDraft, dirty, markSaved, reset } = useDraft(initialPenalties)
  const { status, message, run, clear } = useSave('Penalizaciones')

  const setRate = (index: number, patch: Partial<PenaltyDraft['rates'][number]>) => {
    clear()
    setDraft((current) => ({
      ...current,
      rates: current.rates.map((rate, at) => (at === index ? { ...rate, ...patch } : rate)),
    }))
  }

  const save = () => {
    void run(async () => {
      await savePenaltyConfig(draft)
      markSaved()
    }, () => validatePenalties(draft))
  }

  return (
    <>
      <Card
        title="Penalización por cancelar"
        hint="Cada cancelación suma un aviso y quita XP: el mayor entre el mínimo y el porcentaje de la XP actual. Si hay más avisos que filas, vale la última."
      >
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr><th>Aviso</th><th>% de XP</th><th>XP mínima</th><th /></tr>
            </thead>
            <tbody>
              {draft.rates.map((rate, index) => (
                <tr key={index}>
                  <td>{rate.strike}</td>
                  <td className={styles.num}><NumberInput value={rate.percent} min={0} onChange={(percent) => setRate(index, { percent })} /></td>
                  <td className={styles.num}><NumberInput value={rate.minXp} min={0} onChange={(minXp) => setRate(index, { minXp })} /></td>
                  <td>
                    {index === draft.rates.length - 1 && draft.rates.length > 1 ? (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
                        aria-label="Quitar último aviso"
                        onClick={() => { clear(); setDraft((current) => ({ ...current, rates: current.rates.slice(0, -1) })) }}
                      >
                        ✕
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.chips}>
          <button
            type="button"
            className={styles.chip}
            onClick={() => {
              clear()
              setDraft((current) => {
                const last = current.rates[current.rates.length - 1]
                return { ...current, rates: [...current.rates, { strike: (last?.strike ?? 0) + 1, percent: last?.percent ?? 50, minXp: last?.minXp ?? 100 }] }
              })
            }}
          >
            + Añadir aviso
          </button>
        </div>
      </Card>

      <Card title="Bloqueo de promociones" hint="Al llegar a este número de avisos el comensal pierde el acceso a las promos hasta que baje de él.">
        <div className={styles.grid2}>
          <Field label="Avisos para bloquear">
            <NumberInput value={draft.lockStrikes} min={1} onChange={(lockStrikes) => { clear(); setDraft((current) => ({ ...current, lockStrikes })) }} />
          </Field>
        </div>
      </Card>

      <SaveBar dirty={dirty} status={status} message={message} onSave={save} onReset={() => { reset(); clear() }} />
    </>
  )
}
