import { describe, it, expect } from 'vitest'
import { formatRupiah, generateKodePesanan, hitungSaldo } from './utils'

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

describe('generateKodePesanan', () => {
  it('generates invoice code', () => {
    expect(generateKodePesanan('invoice', 2026, 1)).toBe('INV-2026-0001')
  })
  it('generates nota code', () => {
    expect(generateKodePesanan('nota', 2026, 42)).toBe('NOT-2026-0042')
  })
  it('zero-pads sequence to 4 digits', () => {
    expect(generateKodePesanan('invoice', 2026, 999)).toBe('INV-2026-0999')
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
