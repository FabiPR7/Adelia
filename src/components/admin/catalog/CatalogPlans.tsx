import { useState } from 'react'
import {
  COMPANY_PLAN_CAPABILITIES,
  COMPANY_PLAN_IDS,
  COMPANY_PLANS,
  getCompanyPlan,
  type CompanyPlan,
  type CompanyPlanCapability,
  type CompanyPlanCapValue,
  type CompanyPlanId,
} from '../../../data/companyPlans'
import { savePlanCatalog } from '../../../services/adminCatalog'
import styles from '../AdminCatalog.module.css'
import { Card, Check, Field, linesToList, NumberInput, SaveBar, Select, TextArea, TextInput, useDraft, useSave } from './CatalogUi'

interface PlansDraft {
  plans: CompanyPlan[]
  capabilities: CompanyPlanCapability[]
}

type CapMode = 'off' | 'on' | 'number' | 'unlimited' | 'list'

const CAP_MODES: Array<{ value: CapMode; label: string }> = [
  { value: 'off', label: 'No incluido' },
  { value: 'on', label: 'Incluido' },
  { value: 'number', label: 'Hasta N' },
  { value: 'unlimited', label: 'Sin límite' },
  { value: 'list', label: 'En lista' },
]

function capMode(value: CompanyPlanCapValue): CapMode {
  if (typeof value === 'number') return 'number'
  if (value === true) return 'on'
  if (value === false) return 'off'
  return value
}

function capFromMode(mode: CapMode, previous: CompanyPlanCapValue): CompanyPlanCapValue {
  if (mode === 'off') return false
  if (mode === 'on') return true
  if (mode === 'number') return typeof previous === 'number' ? previous : 1
  return mode
}

function initialDraft(): PlansDraft {
  return {
    plans: COMPANY_PLANS.map((plan) => structuredClone(plan)),
    capabilities: COMPANY_PLAN_CAPABILITIES.map((capability) => structuredClone(capability)),
  }
}

function validate({ plans, capabilities }: PlansDraft): string | null {
  for (const plan of plans) {
    if (!plan.name.trim()) return `El plan ${plan.id} necesita nombre.`
    if (!Number.isFinite(plan.priceMonthly) || plan.priceMonthly < 0) return `Precio mensual no válido en ${plan.name}.`
    if (plan.priceAnnual !== undefined && (!Number.isFinite(plan.priceAnnual) || plan.priceAnnual < 0)) {
      return `Precio anual no válido en ${plan.name}.`
    }
  }
  for (const capability of capabilities) {
    if (!capability.label.trim()) return 'Hay una capacidad sin nombre.'
    for (const planId of COMPANY_PLAN_IDS) {
      const value = capability.values[planId]
      if (typeof value === 'number' && (!Number.isFinite(value) || value < 1)) {
        return `"${capability.label}": el límite debe ser 1 o más.`
      }
    }
  }
  return null
}

export default function CatalogPlans() {
  const { draft, setDraft, dirty, markSaved, reset } = useDraft(initialDraft)
  const { status, message, run, clear } = useSave('Planes y precios')
  const [selected, setSelected] = useState<CompanyPlanId>('basic')

  const plan = draft.plans.find((entry) => entry.id === selected) ?? draft.plans[0]
  const visiblePlans = draft.plans.filter((entry) => entry.id !== 'premium_plus')

  const patchPlan = (patch: Partial<CompanyPlan>) => {
    clear()
    setDraft((current) => ({
      ...current,
      plans: current.plans.map((entry) => (entry.id === plan.id ? { ...entry, ...patch } : entry)),
    }))
  }

  const patchCapability = (capabilityId: string, patch: Partial<CompanyPlanCapability>) => {
    clear()
    setDraft((current) => ({
      ...current,
      capabilities: current.capabilities.map((entry) => (entry.id === capabilityId ? { ...entry, ...patch } : entry)),
    }))
  }

  const setCapValue = (capability: CompanyPlanCapability, planId: CompanyPlanId, value: CompanyPlanCapValue) => {
    patchCapability(capability.id, { values: { ...capability.values, [planId]: value } })
  }

  const save = () => {
    void run(async () => {
      await savePlanCatalog(draft.plans, draft.capabilities)
      markSaved()
    }, () => validate(draft))
  }

  return (
    <>
      <Card
        title="Planes y precios"
        hint="Lo que ve el restaurante en la página de planes y lo que cobra el servidor. El cobro real lo hace Lemon Squeezy: si cambias un precio aquí, cámbialo también allí."
      >
        <div className={styles.tabs} role="tablist" aria-label="Plan">
          {visiblePlans.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === selected}
              className={`${styles.tab} ${entry.id === selected ? styles.tabOn : ''}`}
              onClick={() => setSelected(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>

        <div className={styles.grid2}>
          <Field label="Nombre"><TextInput value={plan.name} onChange={(name) => patchPlan({ name })} /></Field>
          <Field label="Etiqueta del botón"><TextInput value={plan.ctaLabel} onChange={(ctaLabel) => patchPlan({ ctaLabel })} /></Field>
          <Field label="Precio mensual" hint="€, sin IVA">
            <NumberInput value={plan.priceMonthly} min={0} step={0.01} onChange={(priceMonthly) => patchPlan({ priceMonthly })} />
          </Field>
          <Field label="Precio anual" hint="€ del año entero; vacío = sin pago anual">
            <NumberInput
              value={plan.priceAnnual ?? Number.NaN}
              min={0}
              step={0.01}
              onChange={(value) => patchPlan({ priceAnnual: Number.isNaN(value) ? undefined : value })}
            />
          </Field>
          <Field label="Periodo" hint="ej. /mes"><TextInput value={plan.period} onChange={(period) => patchPlan({ period })} /></Field>
          <Field label="Nota de IVA"><TextInput value={plan.vatNote} onChange={(vatNote) => patchPlan({ vatNote })} /></Field>
          <Field label="Insignia" hint="ej. Recomendado"><TextInput value={plan.badge ?? ''} onChange={(badge) => patchPlan({ badge: badge || undefined })} /></Field>
          <Field label="Prueba gratuita" hint="ej. 3 meses de prueba">
            <TextInput value={plan.trialLabel ?? ''} onChange={(trialLabel) => patchPlan({ trialLabel: trialLabel || undefined })} />
          </Field>
        </div>

        <Field label="Para quién es"><TextInput value={plan.audience} onChange={(audience) => patchPlan({ audience })} /></Field>
        <Field label="Incluye todo lo anterior" hint="texto bajo el precio"><TextInput value={plan.includesPrevious ?? ''} onChange={(includesPrevious) => patchPlan({ includesPrevious: includesPrevious || undefined })} /></Field>
        <Check checked={plan.highlighted === true} onChange={(highlighted) => patchPlan({ highlighted: highlighted || undefined })} label="Destacar este plan" />

        <div className={styles.grid2}>
          <Field label="Chips" hint="uno por línea">
            <TextArea rows={5} value={plan.chips.join('\n')} onChange={(value) => patchPlan({ chips: linesToList(value) })} />
          </Field>
          <Field label="Datos rápidos" hint="etiqueta: valor, uno por línea">
            <TextArea
              rows={5}
              value={plan.specs.map((spec) => `${spec.label}: ${spec.value}`).join('\n')}
              onChange={(value) => patchPlan({
                specs: linesToList(value).flatMap((line) => {
                  const [label, ...rest] = line.split(':')
                  const specValue = rest.join(':').trim()
                  return label.trim() && specValue ? [{ label: label.trim(), value: specValue }] : []
                }),
              })}
            />
          </Field>
        </div>

        <Field label="Qué incluye" hint="una ventaja por línea">
          <TextArea rows={9} value={plan.features.join('\n')} onChange={(value) => patchPlan({ features: linesToList(value) })} />
        </Field>
      </Card>

      <Card
        title="Qué incluye cada plan"
        hint="Esta tabla manda en toda la app: límites de cartas, mesas, mapas y promociones, y qué funciones se desbloquean. El servidor aplica estos mismos valores."
      >
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Capacidad</th>
                {COMPANY_PLAN_IDS.map((planId) => (
                  <th key={planId}>{getCompanyPlan(planId).name}{planId === 'premium_plus' ? ' (retirado)' : ''}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.capabilities.map((capability) => (
                <tr key={capability.id}>
                  <td>
                    <TextInput value={capability.label} onChange={(label) => patchCapability(capability.id, { label })} />
                  </td>
                  {COMPANY_PLAN_IDS.map((planId) => {
                    const value = capability.values[planId]
                    const mode = capMode(value)
                    return (
                      <td key={planId}>
                        <div className={styles.capCell}>
                          <Select
                            value={mode}
                            options={CAP_MODES}
                            onChange={(next) => setCapValue(capability, planId, capFromMode(next, value))}
                          />
                          {mode === 'number' ? (
                            <NumberInput
                              value={typeof value === 'number' ? value : 1}
                              min={1}
                              onChange={(next) => setCapValue(capability, planId, next)}
                            />
                          ) : null}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SaveBar dirty={dirty} status={status} message={message} onSave={save} onReset={() => { reset(); clear() }} />
    </>
  )
}
