import { describe, it, expect } from 'vitest'
import { calcOrderTotal, formatRupiah, hitungSaldo } from './utils'

describe('formatRupiah', () => {
  it('formats zero', () => {
    expect(formatRupiah(0)).toBe('Rp 0')
  })
  it('formats thousands', () => {
    expect(formatRupiah(150000)).toBe('Rp 150.000')
  })
  it('formats millions', () => {
    expect(formatRupiah(1200000)).toBe('Rp 1.200.000')
  })
})

describe('hitungSaldo', () => {
  it('returns full amount when nothing paid', () => {
    expect(hitungSaldo(1200000, 0)).toEqual({
      totalPesanan: 1200000,
      totalDibayar: 0,
      sisaTagihan: 1200000,
      statusPembayaran: 'belum_dibayar',
    })
  })
  it('returns partial when partially paid', () => {
    expect(hitungSaldo(1200000, 500000)).toEqual({
      totalPesanan: 1200000,
      totalDibayar: 500000,
      sisaTagihan: 700000,
      statusPembayaran: 'bayar_sebagian',
    })
  })
  it('returns lunas when fully paid', () => {
    expect(hitungSaldo(1200000, 1200000)).toEqual({
      totalPesanan: 1200000,
      totalDibayar: 1200000,
      sisaTagihan: 0,
      statusPembayaran: 'lunas',
    })
  })
})

describe('calcOrderTotal', () => {
  it('sums subtotals across line items', () => {
    const items = [
      { qty: 5, harga_satuan: 150000 },
      { qty: 10, harga_satuan: 45000 },
    ]
    expect(calcOrderTotal(items)).toBe(1200000)
  })

  it('returns 0 for empty items', () => {
    expect(calcOrderTotal([])).toBe(0)
  })
})
