// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPage from './page'

/**
 * `registerOwner` (the server action) is already covered by
 * register/actions.test.ts, but RegisterPage's own submit handler — building
 * the FormData from the form, surfacing the returned error, the
 * redirect+refresh on success, and the loading-state toggle — had no
 * coverage. Mirrors the login page's test, per its own file's rationale.
 */

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const registerOwner = vi.fn()
vi.mock('./actions', () => ({
  registerOwner: (formData: FormData) => registerOwner(formData),
}))

beforeEach(() => {
  push.mockClear()
  refresh.mockClear()
  registerOwner.mockReset()
})

describe('RegisterPage', () => {
  it('renders the nama, email and password fields', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText('Nama')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Daftar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/login')
  })

  it('submits the entered fields and redirects to /pesanan on success', async () => {
    registerOwner.mockResolvedValue({})
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText('Nama'), 'Budi Owner')
    await user.type(screen.getByLabelText('Email'), 'budi@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Daftar' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/pesanan'))
    expect(refresh).toHaveBeenCalled()

    const submittedForm = registerOwner.mock.calls[0][0] as FormData
    expect(submittedForm.get('nama')).toBe('Budi Owner')
    expect(submittedForm.get('email')).toBe('budi@example.com')
    expect(submittedForm.get('password')).toBe('secret123')
  })

  it('shows the returned error and does not navigate when registration fails', async () => {
    registerOwner.mockResolvedValue({ error: 'Registrasi ditutup. Hubungi pemilik untuk dibuatkan akun.' })
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText('Nama'), 'Budi')
    await user.type(screen.getByLabelText('Email'), 'budi@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Daftar' }))

    await waitFor(() =>
      expect(
        screen.getByText('Registrasi ditutup. Hubungi pemilik untuk dibuatkan akun.')
      ).toBeInTheDocument()
    )
    expect(push).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('re-enables the submit button after a failed registration', async () => {
    registerOwner.mockResolvedValue({ error: 'Password minimal 6 karakter.' })
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText('Nama'), 'Budi')
    await user.type(screen.getByLabelText('Email'), 'budi@example.com')
    await user.type(screen.getByLabelText('Password'), '123')
    await user.click(screen.getByRole('button', { name: 'Daftar' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Daftar' })).not.toBeDisabled()
    )
  })

  it('shows a disabled, loading submit button while the request is in flight', async () => {
    let resolveRegister!: (value: { error?: string }) => void
    registerOwner.mockImplementation(
      () => new Promise((resolve) => { resolveRegister = resolve })
    )
    const user = userEvent.setup()
    render(<RegisterPage />)

    await user.type(screen.getByLabelText('Nama'), 'Budi')
    await user.type(screen.getByLabelText('Email'), 'budi@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mendaftar...' })).toBeDisabled()
    )

    resolveRegister({})
    await waitFor(() => expect(push).toHaveBeenCalledWith('/pesanan'))
  })
})
