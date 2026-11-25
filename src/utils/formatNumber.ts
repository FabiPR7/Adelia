/**
 * Número en español con punto de miles también en los de 4 cifras («2.450»).
 * `toLocaleString('es-ES')` deja «2450» porque en español solo agrupa a partir
 * de 10.000, y en marcadores de XP queda raro al lado de «12.300».
 */
let formatter: Intl.NumberFormat | null = null

function getFormatter(): Intl.NumberFormat {
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('es-ES', {
        useGrouping: 'always' as unknown as boolean,
        maximumFractionDigits: 2,
      })
    } catch {
      formatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 })
    }
  }
  return formatter
}

export function formatNumber(value: number): string {
  const text = getFormatter().format(value)
  // Navegadores antiguos que no entienden «always»: se pone el punto a mano.
  return text.replace(/^(-?)(\d)(\d{3})(?=$|,)/, '$1$2.$3')
}
