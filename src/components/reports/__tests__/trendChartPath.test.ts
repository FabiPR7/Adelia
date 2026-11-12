import { describe, expect, it } from 'vitest'
import { buildAreaPath } from '../ReservationTrendChart'

describe('buildAreaPath', () => {
  it('cierra la capa por abajo sin reflejar los picos', () => {
    // Un solo pico el día 2 de 5: el borde de abajo tiene el pico en el mismo día, no en el 4.
    const path = buildAreaPath([0, 1, 0, 0, 0], [0, 2, 0, 0, 0], 2, 400, 100)
    const points = path.replace(/[MZ]/g, '').split('L').map((p) => p.trim()).filter(Boolean)
      .map((p) => p.split(',').map(Number))
    const bottom = points.slice(-5)
    const raised = bottom.filter(([, y]) => y < 113)
    expect(raised).toHaveLength(1)
    const xs = points.slice(1, 6).map(([x]) => x)
    expect(raised[0][0]).toBe(xs[1])
  })
})
