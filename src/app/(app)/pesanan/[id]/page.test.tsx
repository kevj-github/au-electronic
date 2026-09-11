// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * PesananDetailPage's own gate/render logic had thin coverage: only the
 * signed-out -> /login redirect was pinned, leaving the notFound() branch and
 * the whole owner-vs-helper render path (telepon visibility, PembayaranSection
 * gating, reset-checklist button gating on isLocked/statusLocked, catatan
 * visibility) untested. fetchPesananDetail and derivePesananDetailView stay
 * mocked, same as the existing gate test — this is about the page component's
 * own wiring, not the helper functions (which have their own tests).
 */

const redirect = vi.fn((url: string): never => {
  // Next's redirect() signals by throwing; mirror that so the page's own
  // control flow (no `return` after the call) matches production.
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const notFound = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
}))

const getCurrentUser = vi.fn()
const getPesananLocked = vi.fn()
vi.mock('@/lib/supabase/request-cache', () => ({
  getCurrentUser: () => getCurrentUser(),
  getPesananLocked: () => getPesananLocked(),
}))

const createClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClient(),
}))

const fetchPesananDetail = vi.fn()
const derivePesananDetailView = vi.fn()
vi.mock('@/components/pesanan/pesanan-detail', () => ({
  fetchPesananDetail: (...args: unknown[]) => fetchPesananDetail(...args),
  derivePesananDetailView: (...args: unknown[]) => derivePesananDetailView(...args),
}))

vi.mock('@/components/realtime/RealtimeRefresh', () => ({
  RealtimeRefresh: () => null,
}))
vi.mock('@/components/pesanan/PesananDetailHeader', () => ({
  PesananDetailHeader: () => <div data-testid="detail-header" />,
}))
vi.mock('@/components/pesanan/PembayaranSection', () => ({
  PembayaranSection: () => <div data-testid="pembayaran-section" />,
}))
vi.mock('@/components/pesanan/ItemsSection', () => ({
  ItemsSection: () => <div data-testid="items-section" />,
}))
vi.mock('@/components/pesanan/ResetChecklistButton', () => ({
  ResetChecklistButton: ({ target }: { target: 'helper' | 'owner' }) => (
    <button data-testid={`reset-${target}`} />
  ),
}))

function baseDerived(overrides: Record<string, unknown> = {}) {
  return {
    statusLocked: false,
    isLocked: false,
    pembayaranList: [],
    totalPesanan: 100000,
    sisaTagihan: 0,
    nextStatuses: [],
    dicekCount: 1,
    totalItems: 2,
    diambilCount: 1,
    invoiceData: null,
    sectionItems: [],
    ...overrides,
  }
}

function basePesanan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    kode_pesanan: 'A-001',
    status: 'diproses',
    created_at: '2026-09-01T00:00:00Z',
    tanggal_pengiriman: null,
    pengiriman: null,
    colly: null,
    pelanggan: { nama: 'Budi', telepon: '0811', alamat: 'Jl. Mawar' },
    nama_pelanggan: null,
    catatan: null,
    ...overrides,
  }
}

beforeEach(() => {
  redirect.mockClear()
  notFound.mockClear()
  getCurrentUser.mockReset()
  getPesananLocked.mockReset()
  createClient.mockReset()
  fetchPesananDetail.mockReset()
  derivePesananDetailView.mockReset()
})

function owner() {
  return { id: 'u1', role: 'owner', nama: 'Owner', email: 'o@x.test' }
}
function helper() {
  return { id: 'u2', role: 'helper', nama: 'Helper', email: 'h@x.test' }
}

async function callPage() {
  const { default: PesananDetailPage } = await import('./page')
  return PesananDetailPage({ params: Promise.resolve({ id: 'p1' }) })
}

describe('PesananDetailPage', () => {
  it('redirects to /login when there is no signed-in user, before fetching anything', async () => {
    getCurrentUser.mockResolvedValue(null)

    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/login')

    expect(createClient).not.toHaveBeenCalled()
    expect(fetchPesananDetail).not.toHaveBeenCalled()
    expect(getPesananLocked).not.toHaveBeenCalled()
  })

  it('calls notFound() when the pesanan does not exist', async () => {
    getCurrentUser.mockResolvedValue(owner())
    getPesananLocked.mockResolvedValue(false)
    fetchPesananDetail.mockResolvedValue(null)

    await expect(callPage()).rejects.toThrow('NEXT_NOT_FOUND')

    expect(redirect).not.toHaveBeenCalled()
    expect(derivePesananDetailView).not.toHaveBeenCalled()
  })

  it('fetches with isOwner=true for an owner and isOwner=false for a helper', async () => {
    getCurrentUser.mockResolvedValue(helper())
    getPesananLocked.mockResolvedValue(false)
    fetchPesananDetail.mockResolvedValue(basePesanan())
    derivePesananDetailView.mockReturnValue(baseDerived())

    await callPage()

    expect(fetchPesananDetail).toHaveBeenCalledWith(undefined, 'p1', false)
  })

  it('shows PembayaranSection and telepon to an owner', async () => {
    getCurrentUser.mockResolvedValue(owner())
    getPesananLocked.mockResolvedValue(false)
    fetchPesananDetail.mockResolvedValue(basePesanan())
    derivePesananDetailView.mockReturnValue(baseDerived())

    render(await callPage())

    expect(screen.getByTestId('pembayaran-section')).toBeInTheDocument()
    expect(screen.getByText('0811')).toBeInTheDocument()
    expect(screen.getByTestId('reset-owner')).toBeInTheDocument()
  })

  it('hides PembayaranSection, telepon and the owner-checklist row from a helper', async () => {
    getCurrentUser.mockResolvedValue(helper())
    getPesananLocked.mockResolvedValue(false)
    fetchPesananDetail.mockResolvedValue(basePesanan())
    derivePesananDetailView.mockReturnValue(baseDerived())

    render(await callPage())

    expect(screen.queryByTestId('pembayaran-section')).not.toBeInTheDocument()
    expect(screen.queryByText('0811')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reset-owner')).not.toBeInTheDocument()
    // The alamat still shows for everyone.
    expect(screen.getByText('Jl. Mawar')).toBeInTheDocument()
  })

  it('falls back to nama_pelanggan when there is no linked pelanggan', async () => {
    getCurrentUser.mockResolvedValue(owner())
    getPesananLocked.mockResolvedValue(false)
    fetchPesananDetail.mockResolvedValue(
      basePesanan({ pelanggan: null, nama_pelanggan: 'Toko Lama' })
    )
    derivePesananDetailView.mockReturnValue(baseDerived())

    render(await callPage())

    expect(screen.getByText('Toko Lama')).toBeInTheDocument()
  })

  it('hides the helper reset-checklist button when isLocked, and the owner one when statusLocked', async () => {
    getCurrentUser.mockResolvedValue(owner())
    getPesananLocked.mockResolvedValue(true)
    fetchPesananDetail.mockResolvedValue(basePesanan())
    derivePesananDetailView.mockReturnValue(baseDerived({ isLocked: true, statusLocked: true }))

    render(await callPage())

    expect(screen.queryByTestId('reset-helper')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reset-owner')).not.toBeInTheDocument()
  })

  it('shows catatan only when present', async () => {
    getCurrentUser.mockResolvedValue(owner())
    getPesananLocked.mockResolvedValue(false)
    derivePesananDetailView.mockReturnValue(baseDerived())

    fetchPesananDetail.mockResolvedValue(basePesanan({ catatan: null }))
    const { unmount } = render(await callPage())
    expect(screen.queryByText('Catatan')).not.toBeInTheDocument()
    unmount()

    fetchPesananDetail.mockResolvedValue(basePesanan({ catatan: 'Bungkus rapi' }))
    render(await callPage())
    expect(screen.getByText('Bungkus rapi')).toBeInTheDocument()
  })
})
