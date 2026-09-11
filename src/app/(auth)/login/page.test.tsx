// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './page'

/**
 * LoginPage is the only entry point into the app, yet had no coverage of its
 * own submit handler: the success redirect, the failure message, and the
 * loading-state toggle around `signInWithPassword`.
 */

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const signInWithPassword = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}))

beforeEach(() => {
  push.mockClear()
  refresh.mockClear()
  signInWithPassword.mockReset()
})

describe('LoginPage', () => {
  it('renders the email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument()
  })

  it('signs in with the entered credentials and redirects to /pesanan on success', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'owner@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/pesanan'))
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret123',
    })
    expect(refresh).toHaveBeenCalled()
    expect(screen.queryByText('Email atau password salah.')).not.toBeInTheDocument()
  })

  it('shows an error and does not navigate when sign-in fails', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'owner@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    await waitFor(() =>
      expect(screen.getByText('Email atau password salah.')).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('re-enables the submit button after a failed sign-in', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'bad credentials' } })
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'a@b.com')
    await user.type(screen.getByLabelText('Password'), 'x')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Masuk' })).not.toBeDisabled()
    )
  })

  it('shows a disabled, loading submit button while the request is in flight', async () => {
    let resolveSignIn!: (value: { error: null }) => void
    signInWithPassword.mockImplementation(
      () => new Promise((resolve) => { resolveSignIn = resolve })
    )
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.type(screen.getByLabelText('Email'), 'a@b.com')
    await user.type(screen.getByLabelText('Password'), 'x')
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Masuk...' })).toBeDisabled()
    )

    resolveSignIn({ error: null })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/pesanan'))
  })
})
