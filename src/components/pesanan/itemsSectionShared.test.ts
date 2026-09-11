import { describe, it, expect } from 'vitest'
import { rawPrice, numPrice, subtotalOf, type SectionItem } from './itemsSectionShared'

function item(overrides: Partial<SectionItem> = {}): SectionItem {
  return {
    id: 'item-1',
    nama_barang: 'Kabel',
    qty: 3,
    jumlah_diambil: 0,
    ...overrides,
  }
}

describe('rawPrice', () => {
  it('falls back to the item\'s harga_satuan when there is no override', () => {
    expect(rawPrice(item({ harga_satuan: 15000 }), {})).toBe('15000')
  })

  it('returns an empty string when harga_satuan is undefined (helper-facing item)', () => {
    expect(rawPrice(item(), {})).toBe('')
  })

  it('returns an empty string when harga_satuan is exactly 0', () => {
    expect(rawPrice(item({ harga_satuan: 0 }), {})).toBe('')
  })

  it('prefers a price override over harga_satuan', () => {
    expect(rawPrice(item({ harga_satuan: 15000 }), { 'item-1': '20000' })).toBe('20000')
  })

  it('an empty-string override wins over harga_satuan (mid-edit, field cleared)', () => {
    // priceOverrides uses `??`, which only falls through on null/undefined —
    // an explicit '' override (the user cleared the field) must not fall
    // back to the server price.
    expect(rawPrice(item({ harga_satuan: 15000 }), { 'item-1': '' })).toBe('')
  })

  it('ignores an override keyed to a different item id', () => {
    expect(rawPrice(item({ harga_satuan: 15000 }), { 'other-item': '99' })).toBe('15000')
  })
})

describe('numPrice', () => {
  it('parses a valid override to an integer', () => {
    expect(numPrice(item(), { 'item-1': '20000' })).toBe(20000)
  })

  it('parses harga_satuan when there is no override', () => {
    expect(numPrice(item({ harga_satuan: 15000 }), {})).toBe(15000)
  })

  it('is 0 when there is no price at all', () => {
    expect(numPrice(item(), {})).toBe(0)
  })

  it('is 0 for a non-numeric override rather than NaN', () => {
    expect(numPrice(item(), { 'item-1': 'abc' })).toBe(0)
  })

  it('truncates a decimal override to an integer', () => {
    expect(numPrice(item(), { 'item-1': '1250.75' })).toBe(1250)
  })

  it('parses only the leading digits of a malformed override', () => {
    expect(numPrice(item(), { 'item-1': '12abc' })).toBe(12)
  })
})

describe('subtotalOf', () => {
  it('multiplies qty by the resolved price', () => {
    expect(subtotalOf(item({ qty: 4, harga_satuan: 2500 }), {})).toBe(10000)
  })

  it('is 0 when there is no price yet', () => {
    expect(subtotalOf(item({ qty: 4 }), {})).toBe(0)
  })

  it('uses the override over harga_satuan', () => {
    expect(subtotalOf(item({ qty: 2, harga_satuan: 100 }), { 'item-1': '500' })).toBe(1000)
  })

  it('is 0 when qty is 0, even with a price set', () => {
    expect(subtotalOf(item({ qty: 0, harga_satuan: 5000 }), {})).toBe(0)
  })
})
