import { useState } from 'react'
import {
  INVENTORY_ITEMS,
  rarityLabel,
  type InventoryEmblem,
  type InventoryItemDefinition,
  type InventoryItemKind,
  type InventoryRarity,
} from '../../../data/inventoryItems'
import { saveInventoryItem } from '../../../services/adminCatalog'
import styles from '../AdminCatalog.module.css'
import { Card, Check, Field, NumberInput, SaveBar, Select, TextArea, TextInput, useDraft, useSave } from './CatalogUi'

const RARITIES: InventoryRarity[] = ['white', 'copper', 'silver', 'gold', 'azure', 'ash']
const EMBLEMS: InventoryEmblem[] = [
  'stamp', 'cutlery', 'cloche', 'shield', 'key', 'ticket', 'crumb', 'napkin', 'compass',
  'glass', 'note', 'lock', 'spark', 'junk', 'pax', 'clock', 'deposit', 'ghost',
]
const KINDS: Array<{ value: InventoryItemKind; label: string }> = [
  { value: 'reservation_token', label: 'Carta de reservas (suma visitas a una promo)' },
  { value: 'ladder_boost', label: 'Impulso de promo (visitas sin gasto mínimo)' },
  { value: 'cancel_shield', label: 'Escudo de cancelación' },
  { value: 'extra_pax', label: 'Comensal extra' },
  { value: 'deposit_pass', label: 'Salvoconducto de fianza' },
  { value: 'review_boost', label: 'Nota del crítico' },
  { value: 'pardon', label: 'Indulto (quita un aviso)' },
  { value: 'unlock', label: 'Desbloqueo de promos' },
  { value: 'xp', label: 'XP' },
  { value: 'relic', label: 'Reliquia' },
]

const ID_PATTERN = /^[a-z0-9_]{2,40}$/

function blankItem(): InventoryItemDefinition {
  return {
    id: '',
    kind: 'ladder_boost',
    name: '',
    shortName: '',
    description: '',
    howToUse: '',
    howToEarn: 'Se consigue al completar misiones, al reclamar el bonus de temporada o al subir de nivel.',
    rarity: 'copper',
    emblem: 'stamp',
    usable: true,
  }
}

function validate(item: InventoryItemDefinition, isNew: boolean): string | null {
  if (isNew) {
    if (!ID_PATTERN.test(item.id)) return 'El identificador usa minúsculas, números y _ (2 a 40 caracteres).'
    if (INVENTORY_ITEMS.some((entry) => entry.id === item.id)) return 'Ya existe un ítem con ese identificador.'
  }
  if (!item.name.trim()) return 'El ítem necesita nombre.'
  if (!item.shortName.trim()) return 'El ítem necesita nombre corto.'
  if (item.visitValue !== undefined && (!Number.isFinite(item.visitValue) || item.visitValue < 1)) return 'Las visitas deben ser 1 o más.'
  if (item.spendBand !== undefined && (!Number.isFinite(item.spendBand) || item.spendBand < 0)) return 'El gasto mínimo no puede ser negativo.'
  return null
}

function ItemEditor({
  item,
  isNew,
  onSaved,
}: {
  item: InventoryItemDefinition
  isNew: boolean
  onSaved: (id: string) => void
}) {
  const { draft, setDraft, dirty, markSaved, reset } = useDraft(() => ({ ...item }))
  const { status, message, run, clear } = useSave('Objetos')

  const patch = (change: Partial<InventoryItemDefinition>) => {
    clear()
    setDraft((current) => ({ ...current, ...change }))
  }

  const usesVisits = draft.kind === 'reservation_token' || draft.kind === 'ladder_boost'

  const save = () => {
    void run(async () => {
      const clean: InventoryItemDefinition = { ...draft, id: draft.id.trim(), name: draft.name.trim(), shortName: draft.shortName.trim() }
      await saveInventoryItem(clean)
      markSaved(clean)
      onSaved(clean.id)
    }, () => validate(draft, isNew))
  }

  return (
    <>
      <Card
        title={isNew ? 'Nuevo ítem' : draft.name || draft.id}
        hint={isNew
          ? 'El tipo decide qué hace el ítem en la app; el resto son textos y valores. Un tipo de comportamiento nuevo necesita código.'
          : `Identificador: ${draft.id}. El tipo no se puede cambiar porque los comensales ya pueden tenerlo.`}
      >
        <div className={styles.grid2}>
          {isNew ? (
            <Field label="Identificador" hint="no se podrá cambiar">
              <TextInput value={draft.id} onChange={(id) => patch({ id: id.toLowerCase() })} placeholder="sello_oro" />
            </Field>
          ) : null}
          <Field label="Tipo">
            <Select value={draft.kind} options={KINDS} disabled={!isNew} onChange={(kind) => patch({ kind })} />
          </Field>
          <Field label="Nombre"><TextInput value={draft.name} onChange={(name) => patch({ name })} /></Field>
          <Field label="Nombre corto" hint="en la carta pequeña"><TextInput value={draft.shortName} onChange={(shortName) => patch({ shortName })} /></Field>
          <Field label="Rareza">
            <Select
              value={draft.rarity}
              options={RARITIES.map((rarity) => ({ value: rarity, label: rarityLabel(rarity) }))}
              onChange={(rarity) => patch({ rarity })}
            />
          </Field>
          <Field label="Emblema">
            <Select
              value={draft.emblem ?? 'stamp'}
              options={EMBLEMS.map((emblem) => ({ value: emblem, label: emblem }))}
              onChange={(emblem) => patch({ emblem })}
            />
          </Field>
          {usesVisits ? (
            <Field label="Visitas que suma">
              <NumberInput value={draft.visitValue ?? 1} min={1} onChange={(visitValue) => patch({ visitValue: visitValue as InventoryItemDefinition['visitValue'] })} />
            </Field>
          ) : null}
          {draft.kind === 'reservation_token' ? (
            <Field label="Gasto mínimo que cubre" hint="€; 0 = sin mínimo">
              <NumberInput value={draft.spendBand ?? 0} min={0} onChange={(spendBand) => patch({ spendBand: spendBand as InventoryItemDefinition['spendBand'] })} />
            </Field>
          ) : null}
          {draft.kind === 'xp' ? (
            <Field label="XP que da"><NumberInput value={draft.xpValue ?? 0} min={0} onChange={(xpValue) => patch({ xpValue })} /></Field>
          ) : null}
        </div>

        <Field label="Descripción"><TextArea rows={2} value={draft.description} onChange={(description) => patch({ description })} /></Field>
        <Field label="Cómo se usa"><TextArea rows={2} value={draft.howToUse} onChange={(howToUse) => patch({ howToUse })} /></Field>
        <Field label="Cómo se consigue"><TextArea rows={2} value={draft.howToEarn} onChange={(howToEarn) => patch({ howToEarn })} /></Field>

        {usesVisits ? (
          <Check
            checked={draft.coversMinSpend === true}
            onChange={(coversMinSpend) => patch({ coversMinSpend: coversMinSpend || undefined })}
            label="Ignora el gasto mínimo de la promo"
          />
        ) : null}
        <Check checked={draft.usable !== false} onChange={(usable) => patch({ usable })} label="Se puede usar" />
      </Card>
      <SaveBar
        dirty={dirty}
        status={status}
        message={message}
        onSave={save}
        onReset={() => { reset(); clear() }}
        saveLabel={isNew ? 'Crear ítem' : 'Guardar ítem'}
      />
    </>
  )
}

export default function CatalogItems() {
  const [selectedId, setSelectedId] = useState<string>(INVENTORY_ITEMS[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  // Fuerza releer la lista tras guardar (el catálogo en memoria cambia en sitio).
  const [version, setVersion] = useState(0)

  const selected = INVENTORY_ITEMS.find((item) => item.id === selectedId)

  return (
    <>
      <Card title="Ítems del juego" hint="Los ítems que los comensales ganan y gastan. Para cambiar cuántos se dan y cuándo, usa Recompensas. No se pueden borrar: un comensal podría tenerlos.">
        <div className={styles.grid} key={version}>
          {INVENTORY_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.item} ${!creating && item.id === selectedId ? styles.itemOn : ''}`}
              onClick={() => { setCreating(false); setSelectedId(item.id) }}
            >
              <strong>{item.name}</strong>
              <span>{rarityLabel(item.rarity)} · {item.id}</span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.item} ${creating ? styles.itemOn : ''}`}
            onClick={() => setCreating(true)}
          >
            <strong>+ Nuevo ítem</strong>
            <span>Crear desde cero</span>
          </button>
        </div>
      </Card>

      {creating ? (
        <ItemEditor
          key="new"
          item={blankItem()}
          isNew
          onSaved={(id) => { setCreating(false); setSelectedId(id); setVersion((value) => value + 1) }}
        />
      ) : selected ? (
        <ItemEditor key={selected.id} item={selected} isNew={false} onSaved={() => setVersion((value) => value + 1)} />
      ) : null}
    </>
  )
}
