// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddHelperForm } from './AddHelperForm'
import { createUser } from '@/app/(app)/pengaturan/actions'

vi.mock('@/app/(app)/pengaturan/actions', () => ({
  createUser: vi.fn(),
}))

const mockCreateUser = vi.mocked(createUser)

beforeEach(() => {
  mockCreateUser.mockReset()
})

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nama'), 'Budi Helper')
  await user.type(screen.getByLabelText('Email'), 'budi@contoh.com')
  await user.type(screen.getByLabelText('Password'), 'rahasia1')
  await user.click(screen.getByRole('button', { name: 'Tambah Akun' }))
}

describe('AddHelperForm', () => {
  it('submits the entered fields with the default helper role', async () => {
    mockCreateUser.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AddHelperForm />)

    await fillAndSubmit(user)

    await waitFor(() => expect(mockCreateUser).toHaveBeenCalledTimes(1))
    const submitted = mockCreateUser.mock.calls[0][0] as FormData
    expect(submitted.get('nama')).toBe('Budi Helper')
    expect(submitted.get('email')).toBe('budi@contoh.com')
    expect(submitted.get('password')).toBe('rahasia1')
    expect(submitted.get('role')).toBe('helper')
  })

  it('submits owner when the role select is changed', async () => {
    mockCreateUser.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AddHelperForm />)

    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(screen.getByRole('option', { name: 'Owner' }))
    await fillAndSubmit(user)

    await waitFor(() => expect(mockCreateUser).toHaveBeenCalledTimes(1))
    const submitted = mockCreateUser.mock.calls[0][0] as FormData
    expect(submitted.get('role')).toBe('owner')
  })

  it('resets the form after a successful submit', async () => {
    mockCreateUser.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AddHelperForm />)

    await fillAndSubmit(user)

    await waitFor(() => expect(screen.getByLabelText('Nama')).toHaveValue(''))
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('shows the returned error and keeps the entered values on failure', async () => {
    mockCreateUser.mockResolvedValue({ error: 'Email sudah digunakan.' })
    const user = userEvent.setup()
    render(<AddHelperForm />)

    await fillAndSubmit(user)

    expect(await screen.findByText('Email sudah digunakan.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nama')).toHaveValue('Budi Helper')
  })

  it('disables the submit button while the action is in flight', async () => {
    let resolve: (v: { error?: string }) => void = () => {}
    mockCreateUser.mockImplementation(() => new Promise((r) => { resolve = r }))
    const user = userEvent.setup()
    render(<AddHelperForm />)

    await fillAndSubmit(user)

    expect(await screen.findByRole('button', { name: 'Menyimpan...' })).toBeDisabled()

    resolve({})
    await waitFor(() => expect(mockCreateUser).toHaveBeenCalledTimes(1))
  })
})
