import { describe, it, expect } from 'vitest'
import { formatWhatsapp } from './whatsapp'
import type { InvoiceData } from '@/lib/invoice-data'

const mockData: InvoiceData = {
  kodePesanan: 'AU.2026.06.00042',
  tanggal: '2026-06-16',
  namaPelanggan: 'Budi',
  items: [
    { namaBarang: 'Dinamo Mesin', qty: 5, hargaSatuan: 150000, subtotal: 750000 },
    { namaBarang: 'Remote TV', qty: 10, hargaSatuan: 45000, subtotal: 450000 },
  ],
  totalPesanan: 1200000,
  totalDibayar: 500000,
  sisaTagihan: 700000,
  catatan: null,
}

describe('formatWhatsapp', () => {
  it('includes shop name but not the order code', () => {
    const text = formatWhatsapp(mockData)
    expect(text).toContain('*AU Electronic*')
    // The WhatsApp message intentionally omits the order code.
    expect(text).not.toContain('AU.2026.06.00042')
  })

  it('includes all line items', () => {
    const text = formatWhatsapp(mockData)
    expect(text).toContain('Dinamo Mesin')
    expect(text).toContain('Remote TV')
  })

  it('includes total and sisa', () => {
    const text = formatWhatsapp(mockData)
    expect(text).toContain('Rp 1.200.000')
    expect(text).toContain('Rp 700.000')
  })

  it('shows Lunas when fully paid', () => {
    const lunas = { ...mockData, totalDibayar: 1200000, sisaTagihan: 0 }
    const text = formatWhatsapp(lunas)
    expect(text).toContain('*Lunas*')
    expect(text).not.toContain('Sisa')
  })

  it('shows "Belum ditentukan" when tanggalPengiriman is unset', () => {
    const text = formatWhatsapp({ ...mockData, tanggalPengiriman: undefined })
    expect(text).toContain('Tgl. Pengiriman: Belum ditentukan')
  })

  it('formats tanggalPengiriman as d/MM/yyyy in Indonesian locale when set', () => {
    const text = formatWhatsapp({ ...mockData, tanggalPengiriman: '2026-07-04' })
    expect(text).toContain('Tgl. Pengiriman: 4/07/2026')
    expect(text).not.toContain('Belum ditentukan')
  })

  it('omits the catatan line entirely when catatan is null', () => {
    const text = formatWhatsapp({ ...mockData, catatan: null })
    expect(text).not.toContain('Catatan:')
  })

  it('appends the catatan line when catatan is set', () => {
    const text = formatWhatsapp({ ...mockData, catatan: 'Bungkus rapi ya' })
    expect(text).toContain('Catatan: Bungkus rapi ya')
  })
})
