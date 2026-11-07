import { describe, expect, it } from 'vitest'
import { mergeAppendOnlyIds, mergeMonotonicIds } from '../syncMerge.ts'

const catalog = new Set(['a', 'b', 'c', 'd', 'e'])

describe('mergeAppendOnlyIds', () => {
  it('adds new missions up to the limit and defers the rest', () => {
    const result = mergeAppendOnlyIds(['x'], ['x', 'a', 'b', 'c', 'd', 'e'], catalog, 3)

    expect(result.ids).toEqual(['x', 'a', 'b', 'c'])
    expect(result.deferred).toEqual(['d', 'e'])
    expect(result.unknown).toEqual([])
  })

  it('reaches every mission over repeated calls with the same proposal', () => {
    const proposed = ['a', 'b', 'c', 'd', 'e']
    let ids: string[] = []
    let calls = 0
    let deferred = proposed

    while (deferred.length > 0) {
      const result = mergeAppendOnlyIds(ids, proposed, catalog, 2)
      ids = result.ids
      deferred = result.deferred
      calls += 1
    }

    expect(ids).toEqual(proposed)
    expect(calls).toBe(3)
  })

  it('ignores missions outside the catalog without blocking the valid ones', () => {
    const result = mergeAppendOnlyIds([], ['a', 'invented'], catalog, 3)

    expect(result.ids).toEqual(['a'])
    expect(result.unknown).toEqual(['invented'])
  })

  it('keeps missions already completed even if they left the catalog', () => {
    expect(mergeAppendOnlyIds(['retired'], ['retired'], catalog, 3).ids).toEqual(['retired'])
  })

  it('never removes a completed mission the client forgot to send', () => {
    expect(mergeAppendOnlyIds(['a', 'b'], ['a'], catalog, 3).ids).toEqual(['a', 'b'])
  })
})

describe('mergeMonotonicIds', () => {
  it('keeps server ids missing from the proposal and adds the new ones', () => {
    expect(mergeMonotonicIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('applies the size limit', () => {
    expect(mergeMonotonicIds(['a', 'b'], ['c'], 2)).toEqual(['a', 'b'])
  })
})
