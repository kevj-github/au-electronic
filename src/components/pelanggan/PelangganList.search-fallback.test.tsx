import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PelangganList } from './PelangganList'
import type { Pelanggan } from '@/lib/types'

/**
 * Mirrors OrderList.search-fallback.test.tsx: "Cari di semua pelanggan" is
 * offered only when a local search over the (possibly capped)
 * `pelangganList` prop comes back empty AND `truncated` is true.
 */

const searchPelangganGlobal = vi.fn()
vi.mock('@/app/(app)/pelanggan/search-actions', () => ({
  searchPelangganGlobal: (...a: unknown[]) => searchPelangganGlobal(...a),
}))

// DeletePelangganButton (rendered per-row) calls useRouter().
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  searchPelangganGlobal.mockReset()
})

function pelanggan(id: string, nama: string): Pelanggan {
  return {
    id,
    nama,
    telepon: null,
    alamat: null,
    tipe: 'retail',
    created_at: '2026-08-01T00:00:00.000Z',
  }
}

const LIST = [pelanggan('c1', 'Toko Satu')]

describe('PelangganList search-all fallback', () => {
  it('does not offer a fallback when the list was not truncated', async () => {
    const user = userEvent.setup()
    render(<PelangganList pelangganList={LIST} truncated={false} />)

    await user.type(screen.getByPlaceholderText(/Cari nama/), 'tidak ada')

    expect(await screen.findByText(/Tidak ada pelanggan yang cocok/)).toBeInTheDocument()
    expect(screen.queryByText('Cari di semua pelanggan')).not.toBeInTheDocument()
    expect(searchPelangganGlobal).not.toHaveBeenCalled()
  })

  it('offers, calls, and renders results from the full-table search', async () => {
    const user = userEvent.setup()
    searchPelangganGlobal.mockResolvedValue({
      pelangganList: [pelanggan('c99', 'Pelanggan Lama')],
    })

    render(<PelangganList pelangganList={LIST} truncated />)

    await user.type(screen.getByPlaceholderText(/Cari nama/), 'lama')
    const button = await screen.findByText('Cari di semua pelanggan')

    await user.click(button)

    expect(searchPelangganGlobal).toHaveBeenCalledWith('lama', 'semua')
    await waitFor(() =>
      expect(screen.getAllByText('Pelanggan Lama').length).toBeGreaterThan(0),
    )
    expect(
      screen.getByText(/Menampilkan hasil pencarian dari semua pelanggan/),
    ).toBeInTheDocument()
  })

  it('shows the action error and lets the user retry', async () => {
    const user = userEvent.setup()
    searchPelangganGlobal.mockResolvedValue({ error: 'Gagal mencari pelanggan.' })

    render(<PelangganList pelangganList={LIST} truncated />)

    await user.type(screen.getByPlaceholderText(/Cari nama/), 'lama')
    await user.click(await screen.findByText('Cari di semua pelanggan'))

    expect(await screen.findByText('Gagal mencari pelanggan.')).toBeInTheDocument()
    expect(screen.getByText('Cari di semua pelanggan')).toBeInTheDocument()
  })

  it('resets the server-search view once the query changes again', async () => {
    const user = userEvent.setup()
    searchPelangganGlobal.mockResolvedValue({
      pelangganList: [pelanggan('c99', 'Pelanggan Lama')],
    })

    render(<PelangganList pelangganList={LIST} truncated />)

    const input = screen.getByPlaceholderText(/Cari nama/)
    await user.type(input, 'lama')
    await user.click(await screen.findByText('Cari di semua pelanggan'))
    await waitFor(() =>
      expect(screen.getAllByText('Pelanggan Lama').length).toBeGreaterThan(0),
    )

    await user.clear(input)
    await user.type(input, 'lain')

    await waitFor(() =>
      expect(screen.queryByText('Pelanggan Lama')).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/Menampilkan hasil pencarian dari semua pelanggan/),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Cari di semua pelanggan')).toBeInTheDocument()
  })
})
