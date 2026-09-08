// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { UserRole } from '@/lib/types'

/**
 * PelangganBaruPage's owner-only gate had no coverage: an unauthenticated
 * visitor must land on /login, a signed-in helper must be bounced back to
 * /pelanggan (this page has no helper-facing purpose), and only an owner
 * should ever reach the form.
 */

const redirect = vi.fn((url: string): never => {
  // Next's redirect() signals by throwing; mirror that so the page's own
  // control flow (no `return` after the call) matches production.
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

const getCurrentUser = vi.fn()
vi.mock('@/lib/supabase/request-cache', () => ({
  getCurrentUser: () => getCurrentUser(),
}))

vi.mock('@/components/pelanggan/PelangganForm', () => ({
  PelangganForm: () => <div data-testid="pelanggan-form" />,
}))

function user(role: UserRole) {
  return { id: 'u1', role, nama: 'Test', email: 't@x.test' }
}

beforeEach(() => {
  redirect.mockClear()
  getCurrentUser.mockReset()
})

async function callPage() {
  const { default: PelangganBaruPage } = await import('./page')
  return PelangganBaruPage()
}

describe('PelangganBaruPage', () => {
  it('redirects to /login when there is no signed-in user', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('redirects a helper to /pelanggan instead of showing the form', async () => {
    getCurrentUser.mockResolvedValue(user('helper'))
    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/pelanggan')
  })

  it('renders the form for an owner without redirecting', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    render(await callPage())
    expect(screen.getByTestId('pelanggan-form')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })
})
