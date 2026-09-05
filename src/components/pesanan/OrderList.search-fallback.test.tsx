import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderList, type OrderRow } from './OrderList'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/**
 * "Cari di semua pesanan" — offered only when a local search over the
 * (possibly capped) `rows` prop comes back empty AND `truncated` is true,
 * meaning the miss could be explained by the match living past the 500-row
 * PESANAN_LIST_LIMIT. Covers: the fallback staying hidden when not
 * truncated, the round-trip through `searchPesananGlobal`, the error path,
 * and that changing a filter after a server search resets back to local
 * results (the render-time `prevFilterKey` reset, mirroring usePagedList's
 * own pattern).
 */

const searchPesananGlobal = vi.fn()
vi.mock('@/app/(app)/pesanan/search-actions', () => ({
  searchPesananGlobal: (...a: unknown[]) => searchPesananGlobal(...a),
}))

// DeletePesananButton (rendered per-row for an owner) calls useRouter().
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  searchPesananGlobal.mockReset()
})

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

const ROWS = [row('AU.2026.08.00001', 'Toko Satu')]

describe('OrderList search-all fallback', () => {
  it('does not offer a fallback when the list was not truncated', async () => {
    const user = userEvent.setup()
    render(<OrderList rows={ROWS} isOwner truncated={false} />)

    await user.type(screen.getByPlaceholderText(/Cari kode pesanan/), 'tidak ada')

    expect(await screen.findByText(/Tidak ada pesanan yang cocok/)).toBeInTheDocument()
    expect(screen.queryByText('Cari di semua pesanan')).not.toBeInTheDocument()
    expect(searchPesananGlobal).not.toHaveBeenCalled()
  })

  it('offers, calls, and renders results from the full-table search', async () => {
    const user = userEvent.setup()
    searchPesananGlobal.mockResolvedValue({
      rows: [row('AU.2020.01.00099', 'Pelanggan Lama')],
    })

    render(<OrderList rows={ROWS} isOwner truncated />)

    await user.type(screen.getByPlaceholderText(/Cari kode pesanan/), 'lama')
    const button = await screen.findByText('Cari di semua pesanan')

    await user.click(button)

    expect(searchPesananGlobal).toHaveBeenCalledWith('lama', 'diproses')
    await waitFor(() =>
      expect(screen.getAllByText('AU.2020.01.00099').length).toBeGreaterThan(0),
    )
    expect(
      screen.getByText(/Menampilkan hasil pencarian dari semua pesanan/),
    ).toBeInTheDocument()
  })

  it('shows the action error and lets the user retry', async () => {
    const user = userEvent.setup()
    searchPesananGlobal.mockResolvedValue({ error: 'Gagal mencari pesanan.' })

    render(<OrderList rows={ROWS} isOwner truncated />)

    await user.type(screen.getByPlaceholderText(/Cari kode pesanan/), 'lama')
    await user.click(await screen.findByText('Cari di semua pesanan'))

    expect(await screen.findByText('Gagal mencari pesanan.')).toBeInTheDocument()
    // The button survives the failure so the user can try again.
    expect(screen.getByText('Cari di semua pesanan')).toBeInTheDocument()
  })

  it('resets the server-search view once the query changes again', async () => {
    const user = userEvent.setup()
    searchPesananGlobal.mockResolvedValue({
      rows: [row('AU.2020.01.00099', 'Pelanggan Lama')],
    })

    render(<OrderList rows={ROWS} isOwner truncated />)

    const input = screen.getByPlaceholderText(/Cari kode pesanan/)
    await user.type(input, 'lama')
    await user.click(await screen.findByText('Cari di semua pesanan'))
    await waitFor(() =>
      expect(screen.getAllByText('AU.2020.01.00099').length).toBeGreaterThan(0),
    )

    // Editing the query again should drop the stale server results and fall
    // back to the local (empty) filter, re-offering the fallback rather than
    // continuing to show the previous search's results.
    await user.clear(input)
    await user.type(input, 'lain')

    await waitFor(() =>
      expect(screen.queryByText('AU.2020.01.00099')).not.toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/Menampilkan hasil pencarian dari semua pesanan/),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Cari di semua pesanan')).toBeInTheDocument()
  })

  it('does not let a slow, superseded search overwrite a fresher one', async () => {
    const user = userEvent.setup()
    const first = deferred<{ rows?: OrderRow[]; error?: string }>()
    const second = deferred<{ rows?: OrderRow[]; error?: string }>()
    searchPesananGlobal.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    render(<OrderList rows={ROWS} isOwner truncated />)

    const input = screen.getByPlaceholderText(/Cari kode pesanan/)

    // Fire the first search, then edit the query before it resolves — this
    // is the only way two requests can actually overlap, since the button
    // is disabled while one is in flight.
    await user.type(input, 'lama')
    await user.click(await screen.findByText('Cari di semua pesanan'))
    await user.clear(input)
    await user.type(input, 'lain')

    // Editing the query re-offers the fallback (the in-flight request was
    // invalidated, not cancelled). Fire the second, current search.
    await user.click(await screen.findByText('Cari di semua pesanan'))
    expect(searchPesananGlobal).toHaveBeenCalledTimes(2)

    // The second (current) request resolves first...
    await act(async () => {
      second.resolve({ rows: [row('AU.FRESH', 'Fresh')] })
      await second.promise
    })
    await waitFor(() => expect(screen.getAllByText('AU.FRESH').length).toBeGreaterThan(0))

    // ...then the first (now-stale) request finally resolves. Its result
    // must be dropped rather than overwriting what's already shown.
    await act(async () => {
      first.resolve({ rows: [row('AU.STALE', 'Stale')] })
      await first.promise
    })

    expect(screen.queryByText('AU.STALE')).not.toBeInTheDocument()
    expect(screen.getAllByText('AU.FRESH').length).toBeGreaterThan(0)
  })
})
