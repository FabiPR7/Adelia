export type LadderClaimCheck =
  | { ok: true; nextPromotionId: string; completesMap: boolean }
  | { ok: false; status: 409; error: string }

/**
 * Reglas del mapa de premios, las mismas que aplica el cliente al pintarlo:
 *  - se canjea el escalón que toca (el activo del ciclo, o el primero);
 *  - hacen falta `required` visitas NUEVAS desde el último canje (`baseline`);
 *  - al canjear el último escalón el mapa vuelve a empezar desde el primero.
 *
 * `ladderIds` son los escalones activos ordenados por visitas requeridas.
 */
export function checkLadderClaim(input: {
  promotionId: string
  ladderIds: string[]
  activePromotionId: string | undefined
  required: number
  confirmedCount: number
  baseline: number
}): LadderClaimCheck {
  const { promotionId, ladderIds, required, confirmedCount, baseline } = input

  const expectedId = input.activePromotionId && ladderIds.includes(input.activePromotionId)
    ? input.activePromotionId
    : ladderIds[0]
  if (expectedId && promotionId !== expectedId) {
    return { ok: false, status: 409, error: 'Este premio todavía no es el siguiente de tu mapa.' }
  }

  if (confirmedCount - baseline < required) {
    return { ok: false, status: 409, error: 'Aún no has completado las reservas o consumos necesarios.' }
  }

  const index = ladderIds.indexOf(promotionId)
  return {
    ok: true,
    nextPromotionId: ladderIds.length > 0 ? ladderIds[(index + 1) % ladderIds.length] : promotionId,
    completesMap: ladderIds.length > 0 && index === ladderIds.length - 1,
  }
}
