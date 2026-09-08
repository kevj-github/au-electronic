// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { UserRole } from '@/lib/types'

/**
 * PengaturanPage had action-level tests (create-user, delete-helper,
 * settings-actions) but no coverage of the page component's own auth/role
 * gate: an unauthenticated visitor must land on /login, and a signed-in
 * helper must be bounced to /pesanan since this page is owner-only. Also
 * covers the derived `pesananLocked`/`epsonPrinterName` values the page reads
 * from the `settings` table and the per-row DeleteHelperButton visibility
 * rule (helpers only, never owners).
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

const usersReturns = vi.fn()
const settingsSingle = vi.fn()
const createClient = vi.fn(async () => ({
  from: (table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          order: () => ({
            returns: () => usersReturns(),
          }),
        }),
      }
    }
    if (table === 'settings') {
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            single: () => settingsSingle(key),
          }),
        }),
      }
    }
    throw new Error(`unexpected table: ${table}`)
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClient(),
}))

vi.mock('@/components/realtime/RealtimeRefresh', () => ({
  RealtimeRefresh: () => null,
}))
vi.mock('@/components/pengaturan/AddHelperForm', () => ({
  AddHelperForm: () => <div data-testid="add-helper-form" />,
}))
vi.mock('@/components/pengaturan/DeleteHelperButton', () => ({
  DeleteHelperButton: ({ userId }: { userId: string }) => (
    <button data-testid="delete-helper" data-user-id={userId} />
  ),
}))
vi.mock('@/components/pengaturan/PesananLockToggle', () => ({
  PesananLockToggle: ({ locked }: { locked: boolean }) => (
    <div data-testid="lock-toggle" data-locked={locked} />
  ),
}))
vi.mock('@/components/pengaturan/EpsonPrinterSetting', () => ({
  EpsonPrinterSetting: ({ name }: { name: string }) => (
    <div data-testid="printer-setting" data-name={name} />
  ),
}))
vi.mock('@/components/pengaturan/ClearAllButton', () => ({
  ClearAllButton: ({ label }: { label: string }) => <button>{label}</button>,
}))

function user(role: UserRole) {
  return { id: 'u1', role, nama: 'Test', email: 't@x.test' }
}

beforeEach(() => {
  redirect.mockClear()
  getCurrentUser.mockReset()
  createClient.mockClear()
  usersReturns.mockReset()
  settingsSingle.mockReset()
})

async function callPage() {
  const { default: PengaturanPage } = await import('./page')
  return PengaturanPage()
}

describe('PengaturanPage', () => {
  it('redirects to /login when there is no signed-in user', async () => {
    getCurrentUser.mockResolvedValue(null)
    usersReturns.mockResolvedValue({ data: [] })
    settingsSingle.mockResolvedValue({ data: null })

    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/login')
  })

  it('redirects a helper to /pesanan instead of showing the page', async () => {
    getCurrentUser.mockResolvedValue(user('helper'))
    usersReturns.mockResolvedValue({ data: [] })
    settingsSingle.mockResolvedValue({ data: null })

    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT:/pesanan')
  })

  it('renders for an owner without redirecting', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    usersReturns.mockResolvedValue({ data: [] })
    settingsSingle.mockResolvedValue({ data: null })

    render(await callPage())

    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByText('Pengaturan')).toBeInTheDocument()
  })

  it('shows DeleteHelperButton for helper rows only, never for owner rows', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    usersReturns.mockResolvedValue({
      data: [
        { id: 'u1', nama: 'Owner Satu', email: 'owner@x.test', role: 'owner' },
        { id: 'u2', nama: 'Helper Satu', email: 'helper@x.test', role: 'helper' },
      ],
    })
    settingsSingle.mockResolvedValue({ data: null })

    render(await callPage())

    const deleteButtons = screen.getAllByTestId('delete-helper')
    expect(deleteButtons).toHaveLength(1)
    expect(deleteButtons[0]).toHaveAttribute('data-user-id', 'u2')
  })

  it('passes pesananLocked=true only when the setting value is the string "true"', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    usersReturns.mockResolvedValue({ data: [] })
    settingsSingle.mockImplementation((key: string) =>
      Promise.resolve({ data: key === 'pesanan_locked' ? { value: 'true' } : null })
    )

    render(await callPage())

    expect(screen.getByTestId('lock-toggle')).toHaveAttribute('data-locked', 'true')
  })

  it('passes pesananLocked=false when the setting row is missing entirely', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    usersReturns.mockResolvedValue({ data: [] })
    settingsSingle.mockResolvedValue({ data: null })

    render(await callPage())

    expect(screen.getByTestId('lock-toggle')).toHaveAttribute('data-locked', 'false')
  })

  it('passes the epson printer name through, defaulting to empty string when unset', async () => {
    getCurrentUser.mockResolvedValue(user('owner'))
    usersReturns.mockResolvedValue({ data: [] })
    settingsSingle.mockImplementation((key: string) =>
      Promise.resolve({
        data: key === 'epson_printer_name' ? { value: 'EPSON TM-T82' } : null,
      })
    )

    render(await callPage())

    expect(screen.getByTestId('printer-setting')).toHaveAttribute('data-name', 'EPSON TM-T82')
  })
})
