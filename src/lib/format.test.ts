import { describe, it, expect } from 'vitest'
import {
  formatRupiah,
  formatNumberID,
  parseThousandsInput,
  formatThousandsInput,
  formatTanggal,
  formatTanggalPanjang,
  formatTanggalNumerik,
  formatDateInputValue,
} from './format'

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

describe('formatTanggal', () => {
  it('uses the abbreviated Indonesian month', () => {
    expect(formatTanggal(new Date(2026, 7, 5))).toBe('5 Agt 2026')
  })
  it('accepts a Date and an ISO string interchangeably', () => {
    const d = new Date(2026, 0, 31, 13, 45)
    expect(formatTanggal(d.toISOString())).toBe(formatTanggal(d))
  })
})

describe('formatTanggalPanjang', () => {
  it('spells the month out', () => {
    expect(formatTanggalPanjang(new Date(2026, 7, 5))).toBe('5 Agustus 2026')
  })
})

describe('formatTanggalNumerik', () => {
  it('formats as d/MM/yyyy', () => {
    expect(formatTanggalNumerik(new Date(2026, 7, 5))).toBe('5/08/2026')
  })
})

describe('formatDateInputValue', () => {
  it('produces the yyyy-MM-dd shape an <input type="date"> expects', () => {
    expect(formatDateInputValue(new Date(2026, 7, 5))).toBe('2026-08-05')
  })
})
