import { describe, it, expect } from 'vitest'
import { calcOrderTotal, hitungSaldo, orderTotals } from './utils'

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

describe('orderTotals', () => {
  it('sums items and payments with multiple entries', () => {
    expect(orderTotals({
      items: [
        { subtotal: 100000 },
        { subtotal: 200000 },
        { subtotal: 300000 },
      ],
      pembayaran: [
        { jumlah: 150000 },
        { jumlah: 250000 },
      ],
    })).toEqual({
      totalPesanan: 600000,
      totalDibayar: 400000,
    })
  })

  it('handles undefined pembayaran', () => {
    expect(orderTotals({
      items: [
        { subtotal: 500000 },
        { subtotal: 300000 },
      ],
    })).toEqual({
      totalPesanan: 800000,
      totalDibayar: 0,
    })
  })

  it('handles items with undefined subtotal', () => {
    expect(orderTotals({
      items: [
        { subtotal: 100000 },
        {},
        { subtotal: 200000 },
      ],
      pembayaran: [
        { jumlah: 100000 },
      ],
    })).toEqual({
      totalPesanan: 300000,
      totalDibayar: 100000,
    })
  })

  it('returns zeros for empty items array', () => {
    expect(orderTotals({
      items: [],
      pembayaran: [],
    })).toEqual({
      totalPesanan: 0,
      totalDibayar: 0,
    })
  })
})
