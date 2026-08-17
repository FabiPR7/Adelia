import type {
  InventoryItemDefinition,
  InventoryItemKind,
  InventoryRarity,
  InventoryEmblem,
} from './inventoryItems'

const EARN = 'Se consigue al completar misiones, al reclamar el bonus de temporada o al subir de nivel.'

function extra(item: {
  id: string
  kind: InventoryItemKind
  name: string
  shortName: string
  description: string
  howToUse: string
  rarity: InventoryRarity
  emblem: InventoryEmblem
  visitValue?: InventoryItemDefinition['visitValue']
  spendBand?: InventoryItemDefinition['spendBand']
  coversMinSpend?: boolean
}): InventoryItemDefinition {
  return {
    howToEarn: EARN,
    ...item,
    usable: true,
  }
}

export const EXTRA_INVENTORY_ITEMS: InventoryItemDefinition[] = [
  extra({
    id: 'sello_casa',
    kind: 'ladder_boost',
    name: 'Sello de casa',
    shortName: '+1 visita',
    description: 'Suma 1 reserva a la promo de un restaurante, da igual el gasto mínimo.',
    howToUse: 'Pulsa Usar en Promos. En la ficha pulsa Usar carta y elige esta. La visita entra al momento.',
    rarity: 'copper',
    emblem: 'stamp',
    visitValue: 1,
    coversMinSpend: true,
  }),
  extra({
    id: 'doble_sello',
    kind: 'ladder_boost',
    name: 'Doble sello',
    shortName: '+2 visitas',
    description: 'Suma 2 reservas de golpe a una promo, sin importar el gasto mínimo.',
    howToUse: 'Pulsa Usar en Promos. En la ficha pulsa Usar carta. Las dos visitas entran al momento.',
    rarity: 'silver',
    emblem: 'stamp',
    visitValue: 2,
    coversMinSpend: true,
  }),
  extra({
    id: 'triple_sello',
    kind: 'ladder_boost',
    name: 'Triple sello',
    shortName: '+3 visitas',
    description: 'Tres visitas de fidelidad de una vez en un restaurante.',
    howToUse: 'Pulsa Usar en Promos. En la ficha pulsa Usar carta. Entra entero, sin resto de gasto.',
    rarity: 'gold',
    emblem: 'stamp',
    visitValue: 3,
    coversMinSpend: true,
  }),
  extra({
    id: 'llave_promo',
    kind: 'ladder_boost',
    name: 'Llave de promo',
    shortName: 'Salta 1',
    description: 'Salta una visita del mapa de fidelidad. Ignora el gasto mínimo.',
    howToUse: 'Pulsa Usar en Promos. En la ficha pulsa Usar carta. Cuenta como 1 reserva ya hecha.',
    rarity: 'azure',
    emblem: 'key',
    visitValue: 1,
    coversMinSpend: true,
  }),
  extra({
    id: 'llave_maestra',
    kind: 'ladder_boost',
    name: 'Llave maestra',
    shortName: '+5 visitas',
    description: 'Cinco visitas de fidelidad de un plumazo. Completa de golpe un mapa corto.',
    howToUse: 'Pulsa Usar en Promos. En la ficha pulsa Usar carta. Suma 5 reservas de golpe.',
    rarity: 'gold',
    emblem: 'key',
    visitValue: 5,
    coversMinSpend: true,
  }),
  extra({
    id: 'invitacion_extra',
    kind: 'extra_pax',
    name: 'Invitación extra',
    shortName: '+1 comensal',
    description: 'Al reservar puedes sentar a una persona más de las que admite la mesa.',
    howToUse: 'Pulsa Ir a reservar. En la reserva marca Invitación extra: se sienta una persona más de las que admite la mesa.',
    rarity: 'copper',
    emblem: 'pax',
  }),
  extra({
    id: 'salvoconducto',
    kind: 'deposit_pass',
    name: 'Salvoconducto de depósito',
    shortName: 'Sin fianza',
    description: 'Te salta la fianza de una reserva. Esa vez el restaurante no retiene tarjeta.',
    howToUse: 'Pulsa Ir a reservar. Si el local pide fianza, marca Salvoconducto de depósito.',
    rarity: 'gold',
    emblem: 'deposit',
  }),
  extra({
    id: 'indulto',
    kind: 'pardon',
    name: 'Indulto',
    shortName: '−1 aviso',
    description: 'Quita un aviso de cancelación. Si estabas bloqueado y bajas de 5, recuperas promos.',
    howToUse: 'Ábrela en Ítems y pulsa Usar ahora.',
    rarity: 'azure',
    emblem: 'shield',
  }),
  extra({
    id: 'perdon_promos',
    kind: 'unlock',
    name: 'Perdón de promos',
    shortName: 'Desbloquea',
    description: 'Si tienes las promos cerradas por cancelar, te deja en 4 avisos y vuelve a abrir ofertas.',
    howToUse: 'Úsala en Ítems. Solo tiene efecto si estás bloqueado.',
    rarity: 'gold',
    emblem: 'lock',
  }),
  extra({
    id: 'nota_critico',
    kind: 'review_boost',
    name: 'Nota del crítico',
    shortName: 'Reseña extra',
    description: 'Tu próxima reseña da +40 XP y +5 Adelinas extra. Se gasta sola al publicar.',
    howToUse: 'Pulsa Ir a reseñar. Al publicar la próxima reseña se gasta sola.',
    rarity: 'silver',
    emblem: 'note',
  }),
]
