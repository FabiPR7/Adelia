import { describe, expect, it } from 'vitest'
import {
  mergeFavoriteSlugs,
  normalizeFavoriteSlug,
  normalizeFavoriteSlugs,
  sameFavoriteSlugs,
  toggleFavoriteSlug,
} from '../favorites'

describe('favorites', () => {
  it('normaliza slugs a minúsculas sin duplicados', () => {
    expect(normalizeFavoriteSlug(' Logic ')).toBe('logic')
    expect(normalizeFavoriteSlugs(['Logic', 'logic', 'Sala', '', 1])).toEqual(['logic', 'sala'])
  })

  it('quita un favorito aunque la capitalización no coincida', () => {
    expect(toggleFavoriteSlug(['Logic', 'sala'], 'logic')).toEqual(['sala'])
    expect(toggleFavoriteSlug(['sala'], 'Logic')).toEqual(['sala', 'logic'])
  })

  it('compara listas sin importar el orden ni la capitalización', () => {
    expect(sameFavoriteSlugs(['Logic', 'sala'], ['sala', 'logic'])).toBe(true)
    expect(sameFavoriteSlugs(['logic'], ['sala'])).toBe(false)
  })

  it('merge de migración guest une remoto y local una sola vez', () => {
    expect(mergeFavoriteSlugs(['logic'], ['Sala', 'logic'])).toEqual(['logic', 'sala'])
  })
})
