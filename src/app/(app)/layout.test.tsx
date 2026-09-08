// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { UserRole } from '@/lib/types'

/**
 * AppLayout had no coverage of either gate it enforces: the plain
 * unauthenticated redirect, and the whole-app "Sistem Terkunci" branch that
 * `pesanan_locked` renders instead of children. CLAUDE.md documents that the
 * lock is helper-only — an owner must reach AppShell even when the setting
 * is locked — which is exactly the branch a naive `if (pesananLocked)` would
 * get wrong.
 */

const redirect = vi.fn((url: string): never => {
  // Next's redirect() signals by throwing; mirror that so the layout's own
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

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({
    role,
    nama,
    pesananLocked,
    children,
  }: {
    role: string
    nama: string
    pesananLocked: boolean
    children: React.ReactNode
  }) => (
    <div
      data-testid="app-shell"
      data-role={role}
      data-nama={nama}
      data-pesanan-locked={pesananLocked}
    >
      {children}
    </div>
  ),
}))

function user(role: UserRole) {
  return { id: 'u1', role, nama: 'Test User', email: 't@x.test' }
}

beforeEach(() => {
  redirect.mockClear()
  getCurrentUser.mockReset()
  getPesananLocked.mockReset()
})

async function callLayout() {
  const { default: AppLayout } = await import('./layout')
  return AppLayout({ children: <p>page content</p> })
}

describe('AppLayout', () => {
  it('redirects to /login when there is no signed-in user', async () => {
    getCurrentUser.mockResolvedValue(null)
    getPesananLocked.mockResolvedValue(false)
    await expect(callLayout()).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('shows the lock screen instead of children for a helper when locked', async () => {
    getCurrentUser.mockResolvedValue(user('helper'))
    getPesananLocked.mockResolvedValue(true)
    render(await callLayout())

    expect(screen.getByText('Sistem Terkunci')).toBeInTheDocument()
    expect(
      screen.getByText('Pemilik telah mengunci akses. Hubungi pemilik untuk membuka kunci.')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
    expect(screen.queryByText('page content')).not.toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('renders AppShell with children for a helper when not locked', async () => {
    getCurrentUser.mockResolvedValue(user('helper'))
    getPesananLocked.mockResolvedValue(false)
    render(await callLayout())

    const shell = screen.getByTestId('app-shell')
    expect(shell.dataset.role).toBe('helper')
    expect(shell.dataset.pesananLocked).toBe('false')
    expect(screen.getByText('page content')).toBeInTheDocument()
    expect(screen.queryByText('Sistem Terkunci')).not.toBeInTheDocument()
  })

  it('renders AppShell with children for an owner even when locked', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    getPesananLocked.mockResolvedValue(true)
    render(await callLayout())

    const shell = screen.getByTestId('app-shell')
    expect(shell.dataset.role).toBe('owner')
    expect(shell.dataset.pesananLocked).toBe('true')
    expect(screen.getByText('page content')).toBeInTheDocument()
    expect(screen.queryByText('Sistem Terkunci')).not.toBeInTheDocument()
  })
})
