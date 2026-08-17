import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderList, type OrderRow } from './OrderList'

/**
 * The two empty states answer different questions and must not collapse into
 * one another: "you have no orders" needs the create action, "your filters
 * matched nothing" needs a way back out of the filters. The role split matters
 * too — a helper must never be shown the create CTA, since `pesanan_locked`
 * can block them and this component is not told about the lock.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./DeletePesananButton', () => ({ DeletePesananButton: () => null }))

function row(kode: string, nama: string): OrderRow {
  return {
    p: {
      id: kode,
      kode_pesanan: kode,
      status: 'diproses',
      created_at: '2026-08-01T00:00:00.000Z',
      nama_pelanggan: nama,
      pelanggan: null,
      tanggal_pengiriman: null,
    },
    view: {
      diambilCount: 0,
      totalItems: 1,
      totalPesanan: 1000,
      totalDibayar: 0,
      sisaTagihan: 1000,
      tagihan: { kind: 'sisa', amount: 1000 },
    },
  }
}

describe('OrderList — no orders at all', () => {
  it('offers the create action to an owner', () => {
    render(<OrderList rows={[]} isOwner />)
    expect(screen.getByText('Belum ada pesanan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pesanan Baru/i })).toHaveAttribute(
      'href',
      '/pesanan/baru',
    )
  })

  it('never shows the create action to a helper, who may be locked out', () => {
    render(<OrderList rows={[]} isOwner={false} />)
    expect(screen.getByText('Belum ada pesanan')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Pesanan Baru/i })).not.toBeInTheDocument()
  })

  it('does not offer a filter reset when there was nothing to filter', () => {
    render(<OrderList rows={[]} isOwner />)
    expect(screen.queryByRole('button', { name: /Hapus semua filter/i })).not.toBeInTheDocument()
  })
})

describe('OrderList — filters matched nothing', () => {
  const rows = [row('AU.2026.08.00001', 'Budi'), row('AU.2026.08.00002', 'Siti')]

  it('shows the no-match state, not the no-orders state', async () => {
    const user = userEvent.setup()
    render(<OrderList rows={rows} isOwner />)

    await user.type(screen.getByPlaceholderText(/Cari kode pesanan/i), 'zzzzz')

    expect(screen.getByText('Tidak ada pesanan yang cocok')).toBeInTheDocument()
    expect(screen.queryByText('Belum ada pesanan')).not.toBeInTheDocument()
  })

  it('restores the full list when the reset button is used', async () => {
    const user = userEvent.setup()
    render(<OrderList rows={rows} isOwner />)

    const search = screen.getByPlaceholderText(/Cari kode pesanan/i)
    await user.type(search, 'zzzzz')
    await user.click(screen.getByRole('button', { name: /Hapus semua filter/i }))

    expect(screen.queryByText('Tidak ada pesanan yang cocok')).not.toBeInTheDocument()
    expect(screen.getAllByText('AU.2026.08.00001').length).toBeGreaterThan(0)
    expect(search).toHaveValue('')
  })

  it('clears the owner status filter too, not just the search box', async () => {
    const user = userEvent.setup()
    // Owners default to 'diproses'; a cancelled-only list is therefore empty
    // on arrival with no typing at all — the reset must clear that select.
    const dibatalkan: OrderRow = {
      ...row('AU.2026.08.00003', 'Andi'),
      p: { ...row('AU.2026.08.00003', 'Andi').p, status: 'dibatalkan' },
    }
    render(<OrderList rows={[dibatalkan]} isOwner />)

    expect(screen.getByText('Tidak ada pesanan yang cocok')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Hapus semua filter/i }))

    expect(screen.getAllByText('AU.2026.08.00003').length).toBeGreaterThan(0)
  })
})
