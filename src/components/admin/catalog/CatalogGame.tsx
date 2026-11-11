import {
  currentCompanyLevels,
  currentCompanyMissions,
  currentCustomerGame,
  saveCompanyGame,
  saveCustomerGame,
  type CompanyGameDraft,
  type CustomerGameDraft,
} from '../../../services/adminCatalog'
import {
  COMPANY_CONFIRMED_XP,
  COMPANY_MONTHLY_SLOT_COUNT,
  COMPANY_REPLY_XP,
  COMPANY_REVIEW_XP,
  COMPANY_WEEKLY_BONUS_TARGET,
  COMPANY_WEEKLY_BONUS_XP,
  COMPANY_WEEKLY_SLOT_COUNT,
} from '../../../data/companyGamificationCatalog'
import styles from '../AdminCatalog.module.css'
import { Card, ColorInput, Field, NumberInput, SaveBar, TextArea, TextInput, useDraft, useSave } from './CatalogUi'

type Level = CustomerGameDraft['levels'][number]

function levelsProblem(levels: Array<{ level: number; title: string; minXp: number }>): string | null {
  for (const level of levels) {
    if (!level.title.trim()) return `El nivel ${level.level} necesita nombre.`
    if (!Number.isFinite(level.minXp) || level.minXp < 0) return `Nivel ${level.level}: el XP mínimo no es válido.`
  }
  const sorted = [...levels].sort((left, right) => left.level - right.level)
  if (sorted[0] && sorted[0].minXp !== 0) return 'El primer nivel debe empezar en 0 XP.'
  if (sorted.some((level, index) => index > 0 && level.minXp <= sorted[index - 1].minXp)) {
    return 'Cada nivel debe pedir más XP que el anterior.'
  }
  return null
}

function LevelRows<T extends Level | CompanyGameDraft['levels'][number]>({
  levels,
  textKey,
  textLabel,
  onChange,
}: {
  levels: T[]
  textKey: 'reward' | 'perk'
  textLabel: string
  onChange: (index: number, patch: Partial<T>) => void
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr><th>Nivel</th><th>Nombre</th><th>XP mínima</th><th>{textLabel}</th><th>Colores</th></tr>
        </thead>
        <tbody>
          {levels.map((level, index) => (
            <tr key={level.level}>
              <td>{level.level}</td>
              <td><TextInput value={level.title} onChange={(title) => onChange(index, { title } as Partial<T>)} /></td>
              <td className={styles.num}><NumberInput value={level.minXp} min={0} onChange={(minXp) => onChange(index, { minXp } as Partial<T>)} /></td>
              <td><TextInput value={(level as unknown as Record<string, string>)[textKey]} onChange={(value) => onChange(index, { [textKey]: value } as Partial<T>)} /></td>
              <td>
                <div className={styles.capCell}>
                  <ColorInput value={level.colors[0]} onChange={(color) => onChange(index, { colors: [color, level.colors[1]] } as Partial<T>)} />
                  <ColorInput value={level.colors[1]} onChange={(color) => onChange(index, { colors: [level.colors[0], color] } as Partial<T>)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CatalogCustomerGame() {
  const { draft, setDraft, dirty, markSaved, reset } = useDraft<CustomerGameDraft>(currentCustomerGame)
  const { status, message, run, clear } = useSave('Niveles de los clientes')

  const patchConfig = (patch: Partial<CustomerGameDraft['config']>) => {
    clear()
    setDraft((current) => ({ ...current, config: { ...current.config, ...patch } }))
  }

  const save = () => {
    void run(async () => {
      await saveCustomerGame(draft)
      markSaved()
    }, () => {
      const { config } = draft
      const values = [config.weeklyBonusXp, config.weeklyBonusTarget, config.confirmedReservationXp]
      if (values.some((value) => !Number.isFinite(value) || value < 0)) return 'Los valores de XP no pueden estar vacíos ni ser negativos.'
      return levelsProblem(draft.levels)
    })
  }

  return (
    <>
      <Card
        title="Niveles de los comensales"
        hint="Nombre, XP necesaria y premio de perfil de cada nivel. El tope de un nivel se calcula con el siguiente. Las misiones se editan en la pestaña Misiones."
      >
        <LevelRows
          levels={draft.levels}
          textKey="reward"
          textLabel="Premio de perfil"
          onChange={(index, patch) => {
            clear()
            setDraft((current) => ({ ...current, levels: current.levels.map((level, at) => (at === index ? { ...level, ...patch } : level)) }))
          }}
        />
      </Card>

      <Card title="XP del juego" hint="Valores generales de la gamificación de comensales.">
        <div className={styles.grid}>
          <Field label="XP por reserva confirmada">
            <NumberInput value={draft.config.confirmedReservationXp} min={0} onChange={(confirmedReservationXp) => patchConfig({ confirmedReservationXp })} />
          </Field>
          <Field label="XP del bonus semanal">
            <NumberInput value={draft.config.weeklyBonusXp} min={0} onChange={(weeklyBonusXp) => patchConfig({ weeklyBonusXp })} />
          </Field>
          <Field label="Misiones semanales para el bonus">
            <NumberInput value={draft.config.weeklyBonusTarget} min={1} onChange={(weeklyBonusTarget) => patchConfig({ weeklyBonusTarget })} />
          </Field>
        </div>
      </Card>

      <SaveBar dirty={dirty} status={status} message={message} onSave={save} onReset={() => { reset(); clear() }} />
    </>
  )
}

function initialCompany(): CompanyGameDraft {
  return {
    levels: currentCompanyLevels(),
    missions: currentCompanyMissions().map((mission) => ({ ...mission })),
    config: {
      weeklySlotCount: COMPANY_WEEKLY_SLOT_COUNT,
      monthlySlotCount: COMPANY_MONTHLY_SLOT_COUNT,
      weeklyBonusTarget: COMPANY_WEEKLY_BONUS_TARGET,
      weeklyBonusXp: COMPANY_WEEKLY_BONUS_XP,
      confirmedXp: COMPANY_CONFIRMED_XP,
      reviewXp: COMPANY_REVIEW_XP,
      replyXp: COMPANY_REPLY_XP,
    },
  }
}

const CADENCE_LABEL = { weekly: 'Semanales', monthly: 'Mensuales', historical: 'Logros' } as const

export function CatalogCompanyGame() {
  const { draft, setDraft, dirty, markSaved, reset } = useDraft(initialCompany)
  const { status, message, run, clear } = useSave('Juego de los restaurantes')

  const patchConfig = (patch: Partial<CompanyGameDraft['config']>) => {
    clear()
    setDraft((current) => ({ ...current, config: { ...current.config, ...patch } }))
  }

  const patchMission = (id: string, patch: Partial<CompanyGameDraft['missions'][number]>) => {
    clear()
    setDraft((current) => ({
      ...current,
      missions: current.missions.map((mission) => (mission.id === id ? { ...mission, ...patch } : mission)),
    }))
  }

  const save = () => {
    void run(async () => {
      await saveCompanyGame(draft)
      markSaved()
    }, () => {
      const config = Object.values(draft.config)
      if (config.some((value) => !Number.isFinite(value) || value < 0)) return 'Los valores de XP y huecos no pueden estar vacíos ni ser negativos.'
      for (const mission of draft.missions) {
        if (!mission.name.trim()) return `La misión ${mission.id} necesita nombre.`
        if (!Number.isFinite(mission.xp) || mission.xp < 0) return `"${mission.name}": XP no válida.`
        if (!Number.isFinite(mission.target) || mission.target < 1) return `"${mission.name}": el objetivo debe ser 1 o más.`
      }
      return levelsProblem(draft.levels)
    })
  }

  return (
    <>
      <Card
        title="Niveles de los restaurantes"
        hint="Nombre, XP necesaria y frase de cada nivel de la gamificación de locales."
      >
        <LevelRows
          levels={draft.levels}
          textKey="perk"
          textLabel="Frase del nivel"
          onChange={(index, patch) => {
            clear()
            setDraft((current) => ({ ...current, levels: current.levels.map((level, at) => (at === index ? { ...level, ...patch } : level)) }))
          }}
        />
      </Card>

      <Card title="XP de los restaurantes" hint="Cuánto suma cada acción y cuántas misiones se muestran a la vez.">
        <div className={styles.grid}>
          <Field label="XP por reserva confirmada"><NumberInput value={draft.config.confirmedXp} min={0} onChange={(confirmedXp) => patchConfig({ confirmedXp })} /></Field>
          <Field label="XP por reseña recibida"><NumberInput value={draft.config.reviewXp} min={0} onChange={(reviewXp) => patchConfig({ reviewXp })} /></Field>
          <Field label="XP por responder una reseña"><NumberInput value={draft.config.replyXp} min={0} onChange={(replyXp) => patchConfig({ replyXp })} /></Field>
          <Field label="XP del bonus semanal"><NumberInput value={draft.config.weeklyBonusXp} min={0} onChange={(weeklyBonusXp) => patchConfig({ weeklyBonusXp })} /></Field>
          <Field label="Misiones semanales para el bonus"><NumberInput value={draft.config.weeklyBonusTarget} min={1} onChange={(weeklyBonusTarget) => patchConfig({ weeklyBonusTarget })} /></Field>
          <Field label="Misiones semanales visibles"><NumberInput value={draft.config.weeklySlotCount} min={1} onChange={(weeklySlotCount) => patchConfig({ weeklySlotCount })} /></Field>
          <Field label="Misiones mensuales visibles"><NumberInput value={draft.config.monthlySlotCount} min={1} onChange={(monthlySlotCount) => patchConfig({ monthlySlotCount })} /></Field>
        </div>
      </Card>

      {(['weekly', 'monthly', 'historical'] as const).map((cadence) => (
        <Card
          key={cadence}
          title={`Misiones de restaurante · ${CADENCE_LABEL[cadence]}`}
          hint={cadence === 'weekly' ? 'Textos, XP y objetivo. Una misión con regla nueva necesita código.' : undefined}
        >
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr><th>Icono</th><th>Nombre</th><th>Qué hay que hacer</th><th>XP</th><th>Objetivo</th></tr>
              </thead>
              <tbody>
                {draft.missions.filter((mission) => mission.cadence === cadence).map((mission) => (
                  <tr key={mission.id}>
                    <td className={styles.num}><TextInput value={mission.icon} onChange={(icon) => patchMission(mission.id, { icon })} /></td>
                    <td><TextInput value={mission.name} onChange={(name) => patchMission(mission.id, { name })} /></td>
                    <td><TextArea rows={2} value={mission.description} onChange={(description) => patchMission(mission.id, { description })} /></td>
                    <td className={styles.num}><NumberInput value={mission.xp} min={0} onChange={(xp) => patchMission(mission.id, { xp })} /></td>
                    <td className={styles.num}><NumberInput value={mission.target} min={1} onChange={(target) => patchMission(mission.id, { target })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      <SaveBar dirty={dirty} status={status} message={message} onSave={save} onReset={() => { reset(); clear() }} />
    </>
  )
}
