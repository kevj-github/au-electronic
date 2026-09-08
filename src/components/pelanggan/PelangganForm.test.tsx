// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PelangganForm } from './PelangganForm'
import type { Pelanggan } from '@/lib/types'

/**
 * PelangganForm had no coverage of its own submit handler: the client-side
 * "nama wajib diisi" guard that never calls the action, the FormData it
 * builds (including the hidden `id` field only in edit mode), surfacing an
 * error the action returns, and the loading state staying stuck (by design,
 * per setErrorFromResult's contract) while a real redirect would be in
 * flight. Mirrors register/page.test.tsx's mocking pattern, applied to this
 * form's own ./actions import.
 */

const back = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back }),
}))

const upsertPelanggan = vi.fn()
vi.mock('@/app/(app)/pelanggan/actions', () => ({
  upsertPelanggan: (formData: FormData) => upsertPelanggan(formData),
}))

const pelanggan: Pelanggan = {
  id: 'p1',
  nama: 'Budi',
  telepon: '08123',
  alamat: 'Jl. Mawar',
  tipe: 'grosir',
  created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  back.mockClear()
  upsertPelanggan.mockReset()
})

describe('PelangganForm', () => {
  it('renders empty fields with no hidden id when creating a new pelanggan', () => {
    render(<PelangganForm />)
    expect(screen.getByLabelText('Nama Pelanggan')).toHaveValue('')
    expect(screen.getByLabelText('Nomor Telepon')).toHaveValue('')
    expect(screen.getByLabelText('Alamat')).toHaveValue('')
    expect(document.querySelector('input[name="id"]')).not.toBeInTheDocument()
  })

  it('pre-fills fields and a hidden id input when editing an existing pelanggan', () => {
    render(<PelangganForm pelanggan={pelanggan} />)
    expect(screen.getByLabelText('Nama Pelanggan')).toHaveValue('Budi')
    expect(screen.getByLabelText('Nomor Telepon')).toHaveValue('08123')
    expect(screen.getByLabelText('Alamat')).toHaveValue('Jl. Mawar')
    expect(document.querySelector('input[name="id"]')).toHaveValue('p1')
  })

  it('blocks submit and shows a validation error when nama is blank', async () => {
    const user = userEvent.setup()
    render(<PelangganForm />)

    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(await screen.findByText('Nama pelanggan wajib diisi.')).toBeInTheDocument()
    expect(upsertPelanggan).not.toHaveBeenCalled()
  })

  it('clears the validation error once nama is typed', async () => {
    const user = userEvent.setup()
    render(<PelangganForm />)

    await user.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText('Nama pelanggan wajib diisi.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Nama Pelanggan'), 'Budi')
    expect(screen.queryByText('Nama pelanggan wajib diisi.')).not.toBeInTheDocument()
  })

  it('submits the entered fields to upsertPelanggan', async () => {
    upsertPelanggan.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PelangganForm />)

    await user.type(screen.getByLabelText('Nama Pelanggan'), 'Budi Baru')
    await user.type(screen.getByLabelText('Nomor Telepon'), '0811')
    await user.type(screen.getByLabelText('Alamat'), 'Jl. Melati')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(upsertPelanggan).toHaveBeenCalledTimes(1))
    const submittedForm = upsertPelanggan.mock.calls[0][0] as FormData
    expect(submittedForm.get('nama')).toBe('Budi Baru')
    expect(submittedForm.get('telepon')).toBe('0811')
    expect(submittedForm.get('alamat')).toBe('Jl. Melati')
    expect(submittedForm.get('tipe')).toBe('retail')
    expect(submittedForm.get('id')).toBeNull()
  })

  it('shows the returned error and re-enables the button when the action fails', async () => {
    upsertPelanggan.mockResolvedValue({ error: 'Gagal menyimpan pelanggan.' })
    const user = userEvent.setup()
    render(<PelangganForm />)

    await user.type(screen.getByLabelText('Nama Pelanggan'), 'Budi')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(await screen.findByText('Gagal menyimpan pelanggan.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan' })).not.toBeDisabled()
  })

  it('keeps the submit button disabled and loading while a successful save awaits redirect', async () => {
    let resolveUpsert!: (value: { error?: string } | undefined) => void
    upsertPelanggan.mockImplementation(
      () => new Promise((resolve) => { resolveUpsert = resolve })
    )
    const user = userEvent.setup()
    render(<PelangganForm />)

    await user.type(screen.getByLabelText('Nama Pelanggan'), 'Budi')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(await screen.findByRole('button', { name: 'Menyimpan...' })).toBeDisabled()

    resolveUpsert(undefined)
    await waitFor(() => expect(upsertPelanggan).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Menyimpan...' })).toBeDisabled()
  })

  it('calls router.back() when Batal is clicked', async () => {
    const user = userEvent.setup()
    render(<PelangganForm />)

    await user.click(screen.getByRole('button', { name: 'Batal' }))
    expect(back).toHaveBeenCalledTimes(1)
  })
})
