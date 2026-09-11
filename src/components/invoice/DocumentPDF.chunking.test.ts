import { describe, it, expect } from 'vitest'
import { chunkItemsForPages } from './DocumentPDF'

describe('chunkItemsForPages', () => {
  it('returns a single empty page for an empty list', () => {
    expect(chunkItemsForPages([], 12)).toEqual([[]])
  })

  it('puts everything on one page when under the page size', () => {
    const items = [1, 2, 3]
    expect(chunkItemsForPages(items, 12)).toEqual([[1, 2, 3]])
  })

  it('splits into full pages when the count is an exact multiple', () => {
    const items = Array.from({ length: 24 }, (_, i) => i)
    const chunks = chunkItemsForPages(items, 12)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual(items.slice(0, 12))
    expect(chunks[1]).toEqual(items.slice(12, 24))
  })

  it('puts the remainder on a final, shorter page', () => {
    const items = Array.from({ length: 13 }, (_, i) => i)
    const chunks = chunkItemsForPages(items, 12)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(12)
    expect(chunks[1]).toEqual([12])
  })

  it('does not mutate the source array', () => {
    const items = [1, 2, 3, 4]
    const copy = [...items]
    chunkItemsForPages(items, 2)
    expect(items).toEqual(copy)
  })
})
