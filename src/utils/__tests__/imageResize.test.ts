import { describe, expect, it } from 'vitest'
import { fitWithin } from '../imageResize'

describe('reducir fotos del móvil', () => {
  it('una foto de 4032×3024 baja a 2560 de lado mayor sin deformarse', () => {
    expect(fitWithin(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920 })
  })
  it('una vertical de 3472×4624 también', () => {
    expect(fitWithin(3472, 4624, 2560)).toEqual({ width: 1922, height: 2560 })
  })
  it('las fotos pequeñas no se agrandan', () => {
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 })
  })
})
