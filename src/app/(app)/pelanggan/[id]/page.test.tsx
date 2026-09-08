// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { UserRole } from '@/lib/types'

/**
 * EditPelangganPage had no coverage of its auth/role gate or its
 * not-found fallback: an unauthenticated visitor must land on /login, a
 * signed-in helper must be bounced to /pelanggan (this page is owner-only),
 * a missing pelanggan row must trigger notFound(), and only an owner
 * editing a real pelanggan should ever reach the form. The auth check and
 * the pelanggan fetch run in parallel (Promise.all) but are still asserted
 * in priority order: /login beats notFound even when both would apply.
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
vi.mock('@/lib/supabase/request-cache', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

const single = vi.fn()
const createClient = vi.fn(async () => ({
  from: (table: string) => {
    if (table !== 'pelanggan') throw new Error(`unexpected table: ${table}`)
    return {
      select: () => ({
        eq: () => ({ single }),
      }),
    }
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClient(),
}))

vi.mock('@/components/pelanggan/PelangganForm', () => ({
  PelangganForm: ({ pelanggan }: { pelanggan?: { id: string } }) => (
    <div data-testid="pelanggan-form" data-pelanggan-id={pelanggan?.id} />
  ),
}))

function user(role: UserRole) {
  return { id: 'u1', role, nama: 'Test', email: 't@x.test' }
}

beforeEach(() => {
  redirect.mockClear()
  notFound.mockClear()
  getCurrentUser.mockReset()
  createClient.mockClear()
  single.mockReset()
})

async function callPage() {
  const { default: EditPelangganPage } = await import('./page')
  return EditPelangganPage({ params: Promise.resolve({ id: 'p1' }) })
}

describe('EditPelangganPage', () => {
  it('redirects to /login when there is no signed-in user', async () => {
    getCurrentUser.mockResolvedValue(null)
    single.mockResolvedValue({ data: { id: 'p1' }, error: null })

    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('redirects to /login before checking not-found, even when the pelanggan is missing', async () => {
    getCurrentUser.mockResolvedValue(null)
    single.mockResolvedValue({ data: null, error: null })

    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/login')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('redirects a helper to /pelanggan instead of showing the form', async () => {
    getCurrentUser.mockResolvedValue(user('helper'))
    single.mockResolvedValue({ data: { id: 'p1' }, error: null })

    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/pelanggan')
    expect(notFound).not.toHaveBeenCalled()
  })

  it('calls notFound() for an owner when the pelanggan does not exist', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    single.mockResolvedValue({ data: null, error: null })

    await expect(callPage()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('renders the form with the fetched pelanggan for an owner', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    single.mockResolvedValue({ data: { id: 'p1', nama: 'Budi' }, error: null })

    render(await callPage())

    const form = screen.getByTestId('pelanggan-form')
    expect(form).toHaveAttribute('data-pelanggan-id', 'p1')
    expect(redirect).not.toHaveBeenCalled()
    expect(notFound).not.toHaveBeenCalled()
  })
})
