// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { UserRole } from '@/lib/types'

/**
 * PesananBaruPage's redirect gate had no coverage. The rule it encodes is
 * `pesanan_locked` scope: the lock blocks helpers only, never owners (see
 * CLAUDE.md) — an owner must still reach the form even when the setting is
 * locked, which is exactly the branch a naive `if (pesananLocked) redirect()`
 * would get wrong.
 */

const redirect = vi.fn((url: string): never => {
  // Next's redirect() signals by throwing; mirror that so the page's own
  // control flow (no `return` after the call) matches production.
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

const getCurrentUser = vi.fn()
const getPesananLocked = vi.fn()
vi.mock('@/lib/supabase/request-cache', () => ({
  getCurrentUser: () => getCurrentUser(),
  getPesananLocked: () => getPesananLocked(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const builder = {
      select: () => builder,
      order: () => builder,
      returns: () => builder,
      then: (
        resolve: (v: { data: unknown[] }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve({ data: [] }).then(resolve, reject),
    }
    return { from: () => builder }
  },
}))

vi.mock('@/components/pesanan/OrderForm', () => ({
  OrderForm: ({ isOwner }: { isOwner: boolean }) => (
    <div data-testid="order-form" data-is-owner={isOwner} />
  ),
}))

function user(role: UserRole) {
  return { id: 'u1', role, nama: 'Test', email: 't@x.test' }
}

beforeEach(() => {
  redirect.mockClear()
  getCurrentUser.mockReset()
  getPesananLocked.mockReset()
})

async function callPage() {
  const { default: PesananBaruPage } = await import('./page')
  return PesananBaruPage()
}

describe('PesananBaruPage', () => {
  it('redirects to /login when there is no signed-in user', async () => {
    getCurrentUser.mockResolvedValue(null)
    getPesananLocked.mockResolvedValue(false)
    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('redirects a helper to /pesanan when pesanan is locked', async () => {
    getCurrentUser.mockResolvedValue(user('helper'))
    getPesananLocked.mockResolvedValue(true)
    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/pesanan')
  })

  it('renders the form for a helper when pesanan is not locked', async () => {
    getCurrentUser.mockResolvedValue(user('helper'))
    getPesananLocked.mockResolvedValue(false)
    render(await callPage())
    const form = screen.getByTestId('order-form')
    expect(form).toBeInTheDocument()
    expect(form.dataset.isOwner).toBe('false')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('renders the form for an owner even when pesanan is locked', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    getPesananLocked.mockResolvedValue(true)
    render(await callPage())
    const form = screen.getByTestId('order-form')
    expect(form).toBeInTheDocument()
    expect(form.dataset.isOwner).toBe('true')
    expect(redirect).not.toHaveBeenCalled()
  })
})
