import { describe, it, expect } from 'vitest'
import { formatRupiah, hitungSaldo, formatNumberID, formatThousandsInput, parseThousandsInput, orderTotals, isActiveRoute, listCountNotice, escapeIlike, mergeSearchResults } from './utils'

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

describe('formatNumberID', () => {
  it('groups thousands with dots and no Rp', () => {
    expect(formatNumberID(1000000)).toBe('1.000.000')
    expect(formatNumberID(0)).toBe('0')
    expect(formatNumberID(1500)).toBe('1.500')
  })
})

describe('parseThousandsInput', () => {
  it('keeps only digits', () => {
    expect(parseThousandsInput('1.000.000')).toBe('1000000')
    expect(parseThousandsInput('Rp 2.500a')).toBe('2500')
    expect(parseThousandsInput('')).toBe('')
  })
})

describe('formatThousandsInput', () => {
  it('formats digit runs with dot grouping', () => {
    expect(formatThousandsInput('1000000')).toBe('1.000.000')
    expect(formatThousandsInput('1.000')).toBe('1.000')
    expect(formatThousandsInput('')).toBe('')
    expect(formatThousandsInput('0')).toBe('0')
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

describe('listCountNotice', () => {
  it('shows just the count when not truncated', () => {
    expect(listCountNotice(12, 12, 'pesanan')).toBe('12 pesanan')
  })

  it('shows just the count when shown exceeds count (defensive)', () => {
    expect(listCountNotice(5, 10, 'pesanan')).toBe('5 pesanan')
  })

  it('falls back to shown when count is null', () => {
    expect(listCountNotice(null, 500, 'pesanan')).toBe('500 pesanan')
  })

  it('appends a truncation notice with a suffix when capped', () => {
    expect(listCountNotice(612, 500, 'pesanan', 'terbaru')).toBe(
      '612 pesanan — menampilkan 500 terbaru',
    )
  })

  it('appends a truncation notice without a suffix when none given', () => {
    expect(listCountNotice(612, 500, 'pelanggan terdaftar')).toBe(
      '612 pelanggan terdaftar — menampilkan 500',
    )
  })
})

describe('escapeIlike', () => {
  it('leaves plain text untouched', () => {
    expect(escapeIlike('toko satu')).toBe('toko satu')
  })

  it('escapes a literal percent sign', () => {
    expect(escapeIlike('50%')).toBe('50\\%')
  })

  it('escapes a literal underscore', () => {
    expect(escapeIlike('AU_2026')).toBe('AU\\_2026')
  })

  it('escapes multiple wildcards in one string', () => {
    expect(escapeIlike('%_%')).toBe('\\%\\_\\%')
  })
})

describe('mergeSearchResults', () => {
  it('dedupes a row that matched more than one query', () => {
    const a = { id: '1', nama: 'Budi' }
    const b = { id: '2', nama: 'Ani' }
    const result = mergeSearchResults(
      [[a, b], [a]],
      (row) => row.id,
      (x, y) => x.nama.localeCompare(y.nama),
      10,
    )
    expect(result).toEqual([b, a])
  })

  it('sorts the merged set with the given comparator', () => {
    const result = mergeSearchResults(
      [[{ id: '1', created_at: '2026-01-01' }], [{ id: '2', created_at: '2026-06-01' }]],
      (row) => row.id,
      (x, y) => (x.created_at < y.created_at ? 1 : -1),
      10,
    )
    expect(result.map((r) => r.id)).toEqual(['2', '1'])
  })

  it('caps the result at limit', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }))
    const result = mergeSearchResults([rows], (row) => row.id, () => 0, 3)
    expect(result).toHaveLength(3)
  })

  it('handles empty result sets', () => {
    expect(mergeSearchResults([[], []], (row: { id: string }) => row.id, () => 0, 10)).toEqual([])
  })
})

describe('isActiveRoute', () => {
  it('matches an exact path', () => {
    expect(isActiveRoute('/pesanan', '/pesanan')).toBe(true)
  })

  it('matches a sub-path', () => {
    expect(isActiveRoute('/pesanan/123', '/pesanan')).toBe(true)
  })

  it('does not match a sibling path with a shared prefix', () => {
    expect(isActiveRoute('/pesananan', '/pesanan')).toBe(false)
  })

  it('does not match an unrelated path', () => {
    expect(isActiveRoute('/pelanggan', '/pesanan')).toBe(false)
  })

  it('does not match the root against a nested href', () => {
    expect(isActiveRoute('/', '/pesanan')).toBe(false)
  })
})
