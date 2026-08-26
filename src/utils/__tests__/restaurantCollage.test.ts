import { describe, expect, it } from 'vitest'
import { buildCollageSlots } from '../restaurantCollage'

describe('buildCollageSlots', () => {
  it('sin vídeos deja la foto principal en grande', () => {
    const slots = buildCollageSlots(['a.jpg', 'b.jpg', 'c.jpg'], [], 1)
    expect(slots.featuredVideo).toBeNull()
    expect(slots.staticSmall.map((item) => item.url)).toEqual(['b.jpg', 'a.jpg', 'c.jpg'])
    expect(slots.tileCount).toBe(3)
  })

  it('con vídeo ocupa la pieza grande y pasa las fotos a las pequeñas', () => {
    const slots = buildCollageSlots(
      ['main.jpg', 'two.jpg', 'three.jpg'],
      ['clip-a.mp4'],
      0,
    )
    expect(slots.featuredVideo).toBe('clip-a.mp4')
    expect(slots.staticSmall.map((item) => item.url)).toEqual(['main.jpg', 'two.jpg', 'three.jpg'])
    expect(slots.leftovers).toEqual([])
    expect(slots.tileCount).toBe(4)
  })

  it('con dos vídeos y muchas fotos deja los clips en grande y rota solo fotos pequeñas', () => {
    const slots = buildCollageSlots(
      ['p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg'],
      ['v1.mp4', 'v2.mp4'],
      0,
      0,
    )
    expect(slots.featuredVideo).toBe('v1.mp4')
    expect(slots.staticSmall).toHaveLength(3)
    expect(slots.staticSmall.every((item) => item.type === 'image')).toBe(true)
    expect(slots.leftovers.every((item) => item.type === 'image')).toBe(true)
    expect(slots.leftovers.map((item) => item.url)).toEqual(['p4.jpg', 'p5.jpg'])
    expect(slots.tileCount).toBe(5)
  })

  it('al pasar al segundo vídeo, las piezas pequeñas siguen siendo fotos', () => {
    const slots = buildCollageSlots(['p1.jpg'], ['v1.mp4', 'v2.mp4'], 0, 1)
    expect(slots.featuredVideo).toBe('v2.mp4')
    expect(slots.staticSmall).toEqual([{ type: 'image', url: 'p1.jpg' }])
    expect(slots.leftovers).toEqual([])
    expect(slots.tileCount).toBe(2)
  })
})
