import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The most-visited page in the app had no test asserting a signed-out
 * visitor is redirected to /login before any pesanan data is fetched.
 * Scoped to just that gate, not the full render (which needs the pesanan
 * fetch, item/payment sections, etc. mocked) — this pins the one thing that
 * matters for an unauthenticated request: it never reaches the DB.
 */

const redirect = vi.fn((url: string): never => {
  // Next's redirect() signals by throwing; mirror that so the page's own
  // control flow (no `return` after the call) matches production.
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
  notFound: vi.fn(),
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
vi.mock('@/components/pesanan/pesanan-detail', () => ({
  fetchPesananDetail: (...args: unknown[]) => fetchPesananDetail(...args),
  derivePesananDetailView: vi.fn(),
}))

beforeEach(() => {
  redirect.mockClear()
  getCurrentUser.mockReset()
  getPesananLocked.mockReset()
  createClient.mockReset()
  fetchPesananDetail.mockReset()
})

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
})
