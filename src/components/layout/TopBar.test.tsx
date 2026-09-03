import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopBar } from './TopBar'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const signOut = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut } }),
}))

vi.mock('./ThemeToggle', () => ({
  ThemeToggle: () => null,
}))

const onMenuClick = vi.fn()

beforeEach(() => {
  push.mockClear()
  refresh.mockClear()
  signOut.mockReset()
  onMenuClick.mockClear()
})

describe('TopBar', () => {
  it('renders the given title', () => {
    render(<TopBar title="Pesanan" onMenuClick={onMenuClick} />)
    expect(screen.getByText('Pesanan')).toBeInTheDocument()
  })

  it('calls onMenuClick when the mobile menu button is clicked', async () => {
    const user = userEvent.setup()
    render(<TopBar title="Pesanan" onMenuClick={onMenuClick} />)
    await user.click(screen.getByRole('button', { name: 'Buka menu' }))
    expect(onMenuClick).toHaveBeenCalledTimes(1)
  })

  it('signs out and navigates to /login on logout', async () => {
    signOut.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<TopBar title="Pesanan" onMenuClick={onMenuClick} />)

    await user.click(screen.getByRole('button', { name: 'Keluar' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('disables the button and shows a loading label while signing out', async () => {
    let resolveSignOut: (v: { error: null }) => void = () => {}
    signOut.mockImplementation(() => new Promise((resolve) => { resolveSignOut = resolve }))
    const user = userEvent.setup()
    render(<TopBar title="Pesanan" onMenuClick={onMenuClick} />)

    await user.click(screen.getByRole('button', { name: 'Keluar' }))

    const button = await screen.findByRole('button', { name: 'Keluar...' })
    expect(button).toBeDisabled()

    resolveSignOut({ error: null })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'))
  })

  it('re-enables the button and does not navigate if signOut rejects', async () => {
    signOut.mockRejectedValue(new Error('network error'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<TopBar title="Pesanan" onMenuClick={onMenuClick} />)

    await user.click(screen.getByRole('button', { name: 'Keluar' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Keluar' })).not.toBeDisabled())
    expect(push).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()

    consoleError.mockRestore()
  })
})
