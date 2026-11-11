import { useEffect, useState } from 'react'
import { loadBillingConfig, saveBillingConfig, type BillingConfig, type BillingVariant } from '../../../services/adminCatalog'
import styles from '../AdminCatalog.module.css'
import { Card, Field, SaveBar, Select, TextInput, useDraft, useSave } from './CatalogUi'

const PLAN_OPTIONS = [
  { value: 'basic' as const, label: 'Sala' },
  { value: 'premium' as const, label: 'Local' },
]
const PERIOD_OPTIONS = [
  { value: 'monthly' as const, label: 'Mensual' },
  { value: 'annual' as const, label: 'Anual' },
]

function BillingEditor({ initial }: { initial: BillingConfig }) {
  const { draft, setDraft, dirty, markSaved, reset } = useDraft(() => structuredClone(initial))
  const { status, message, run, clear } = useSave('Cobro con Lemon Squeezy')

  const patch = (change: Partial<BillingConfig>) => {
    clear()
    setDraft((current) => ({ ...current, ...change }))
  }

  const setVariant = (index: number, change: Partial<BillingVariant>) =>
    patch({ variants: draft.variants.map((variant, at) => (at === index ? { ...variant, ...change } : variant)) })

  const save = () => {
    void run(async () => {
      await saveBillingConfig(draft)
      markSaved()
    }, () => {
      if (!/^https:\/\//.test(draft.checkoutUrl.trim())) return 'El enlace de pago debe empezar por https://.'
      const ids = draft.variants.map((variant) => variant.variantId.trim())
      if (ids.some((id) => !/^\d+$/.test(id))) return 'Los IDs de variante son números (los ves en Lemon Squeezy).'
      if (new Set(ids).size !== ids.length) return 'Hay un ID de variante repetido.'
      for (const plan of ['basic', 'premium'] as const) {
        if (!draft.variants.some((variant) => variant.plan === plan)) return 'Cada plan de pago necesita al menos una variante.'
      }
      return null
    })
  }

  return (
    <>
      <Card
        title="Cobro con Lemon Squeezy"
        hint="El enlace y las variantes que usa Adelia para vender planes y reconocer qué compró cada restaurante. Al pasar de modo prueba a real, cambian los IDs: actualízalos aquí, sin desplegar."
      >
        <p className={styles.note}>
          Cuidado: si un ID de variante no coincide con Lemon Squeezy, el pago se cobra pero el plan no se activa.
        </p>
        <div className={styles.grid2}>
          <Field label="Enlace de pago"><TextInput value={draft.checkoutUrl} onChange={(checkoutUrl) => patch({ checkoutUrl })} /></Field>
          <Field label="ID de la tienda"><TextInput value={draft.storeId} onChange={(storeId) => patch({ storeId })} /></Field>
        </div>
      </Card>

      <Card title="Variantes" hint="Cada variante de Lemon Squeezy equivale a un plan y un periodo.">
        <div className={styles.rows}>
          {draft.variants.map((variant, index) => (
            <div key={index} className={styles.grid} style={{ alignItems: 'end' }}>
              <Field label="ID de variante"><TextInput value={variant.variantId} onChange={(variantId) => setVariant(index, { variantId })} /></Field>
              <Field label="Plan"><Select value={variant.plan} options={PLAN_OPTIONS} onChange={(plan) => setVariant(index, { plan })} /></Field>
              <Field label="Periodo"><Select value={variant.period} options={PERIOD_OPTIONS} onChange={(period) => setVariant(index, { period })} /></Field>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => patch({ variants: draft.variants.filter((_, at) => at !== index) })}
              >
                Quitar
              </button>
            </div>
          ))}
          <div className={styles.chips}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => patch({ variants: [...draft.variants, { variantId: '', plan: 'basic', period: 'monthly' }] })}
            >
              + Añadir variante
            </button>
          </div>
        </div>
      </Card>

      <SaveBar dirty={dirty} status={status} message={message} onSave={save} onReset={() => { reset(); clear() }} />
    </>
  )
}

export default function CatalogBilling() {
  const [config, setConfig] = useState<BillingConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadBillingConfig()
      .then((value) => { if (active) setConfig(value) })
      .catch(() => { if (active) setError('No se pudo leer la configuración de cobro.') })
    return () => { active = false }
  }, [])

  if (error) return <p className={styles.note}>{error}</p>
  if (!config) return <p className={styles.loading}>Cargando…</p>
  return <BillingEditor initial={config} />
}
