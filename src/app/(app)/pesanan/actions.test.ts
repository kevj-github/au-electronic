import { describe, it, expect } from 'vitest'
import { calcOrderTotal } from './actions'

describe('calcOrderTotal', () => {
  it('sums subtotals across line items', () => {
    const items = [
      { qty: 5, harga_satuan: 150000, diskon: 0 },
      { qty: 10, harga_satuan: 45000, diskon: 0 },
    ]
    expect(calcOrderTotal(items)).toBe(1200000)
  })

  it('applies per-item discount', () => {
    const items = [{ qty: 2, harga_satuan: 100000, diskon: 10000 }]
    expect(calcOrderTotal(items)).toBe(190000)
  })

  it('returns 0 for empty items', () => {
    expect(calcOrderTotal([])).toBe(0)
  })
})
