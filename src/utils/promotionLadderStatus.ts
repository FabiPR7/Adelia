// El estado de cada escalón del mapa lo calcula el servidor (services/customerLadders.ts).
export type { LadderNodeStatus } from '../services/customerLadders'

export function formatLadderCompletionsLabel(completions: number): string | null {
  if (completions <= 0) {
    return null
  }

  return completions === 1
    ? 'Completado 1 vez'
    : `Completado ${completions} veces`
}
