// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppShell } from './AppShell'

/**
 * AppShell holds the mobile sidebar-drawer toggle shared between Sidebar and
 * TopBar — it can't live in a Server Component, per CLAUDE.md's note on
 * lifting shared client state into a wrapper. This exercises that toggle and
 * the props/derived title AppShell hands to its children, with Sidebar/TopBar/
 * NewOrderFab stubbed out so the test stays about AppShell's own wiring.
 */

let pathname = '/pesanan'
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('./Sidebar', () => ({
  Sidebar: ({
    role,
    nama,
    open,
    onClose,
  }: {
    role: string
    nama: string
    open: boolean
    onClose: () => void
  }) => (
    <div data-testid="sidebar" data-role={role} data-nama={nama} data-open={open}>
      <button onClick={onClose}>close-sidebar</button>
    </div>
  ),
}))

vi.mock('./TopBar', () => ({
  TopBar: ({ title, onMenuClick }: { title: string; onMenuClick: () => void }) => (
    <div data-testid="topbar" data-title={title}>
      <button onClick={onMenuClick}>open-sidebar</button>
    </div>
  ),
}))

vi.mock('./NewOrderFab', () => ({
  NewOrderFab: ({ role, pesananLocked }: { role: string; pesananLocked: boolean }) => (
    <div data-testid="fab" data-role={role} data-locked={pesananLocked} />
  ),
}))

beforeEach(() => {
  pathname = '/pesanan'
})

describe('AppShell', () => {
  it('renders children inside the main content area', () => {
    render(
      <AppShell role="owner" nama="Budi" pesananLocked={false}>
        <p>Isi halaman</p>
      </AppShell>
    )
    expect(screen.getByText('Isi halaman')).toBeInTheDocument()
  })

  it('passes role, nama and the derived section title from the pathname to its children', () => {
    pathname = '/dashboard'
    render(
      <AppShell role="owner" nama="Budi" pesananLocked={false}>
        <p>x</p>
      </AppShell>
    )
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-role', 'owner')
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-nama', 'Budi')
    expect(screen.getByTestId('topbar')).toHaveAttribute('data-title', 'Dashboard')
  })

  it('falls back to the default title on an unmatched pathname', () => {
    pathname = '/unknown-route'
    render(
      <AppShell role="owner" nama="Budi" pesananLocked={false}>
        <p>x</p>
      </AppShell>
    )
    expect(screen.getByTestId('topbar')).toHaveAttribute('data-title', 'AU Electronic')
  })

  it('passes role and pesananLocked through to NewOrderFab', () => {
    render(
      <AppShell role="helper" nama="Budi" pesananLocked={true}>
        <p>x</p>
      </AppShell>
    )
    const fab = screen.getByTestId('fab')
    expect(fab).toHaveAttribute('data-role', 'helper')
    expect(fab).toHaveAttribute('data-locked', 'true')
  })

  it('starts with the sidebar closed', () => {
    render(
      <AppShell role="owner" nama="Budi" pesananLocked={false}>
        <p>x</p>
      </AppShell>
    )
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false')
  })

  it('opens the sidebar when TopBar requests it, and closes it via Sidebar onClose', async () => {
    const user = userEvent.setup()
    render(
      <AppShell role="owner" nama="Budi" pesananLocked={false}>
        <p>x</p>
      </AppShell>
    )

    await user.click(screen.getByText('open-sidebar'))
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true')

    await user.click(screen.getByText('close-sidebar'))
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false')
  })
})
