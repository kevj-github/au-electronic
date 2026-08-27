import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderForm } from './OrderForm'

/**
 * canSubmit disables Simpan Pesanan on an empty order or an incomplete line
 * item, but a disabled button gives no feedback on what to fix. These tests
 * cover the hint shown next to it — scoped to the mobile (`sm:hidden`) layout
 * since both layouts render the same fields with the same labels.
 */

vi.mock('@/app/(app)/pesanan/actions', () => ({
  createPesanan: vi.fn(async () => ({ pesananId: 'p1' })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

function mobileScope(container: HTMLElement) {
  return within(container.querySelector('.sm\\:hidden.space-y-2') as HTMLElement)
}

describe('OrderForm disabled-Simpan hint', () => {
  it('shows no hint on a pristine, untouched form', () => {
    render(<OrderForm pelangganList={[]} isOwner />)

    expect(screen.getByRole('button', { name: 'Simpan Pesanan' })).toBeDisabled()
    expect(screen.queryByText(/tambahkan minimal satu barang/i)).not.toBeInTheDocument()
  })

  it('asks to add a barang once the form is dirty but still has none', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    await user.type(screen.getByPlaceholderText('Nama pelanggan baru...'), 'Budi')

    expect(
      screen.getByText('Tambahkan minimal satu barang sebelum menyimpan.')
    ).toBeInTheDocument()
  })

  it('asks for both name and qty on a freshly added, untouched line', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))

    expect(
      screen.getByText('Isi nama dan jumlah (qty) untuk setiap barang.')
    ).toBeInTheDocument()
  })

  it('asks only for qty once a name is filled in', async () => {
    const user = userEvent.setup()
    const { container } = render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    const mobile = mobileScope(container)
    await user.type(mobile.getByPlaceholderText('Nama barang...'), 'Kabel')

    expect(
      screen.getByText('Isi jumlah (qty) minimal 1 untuk setiap baris.')
    ).toBeInTheDocument()
  })

  it('asks only for name once qty is filled in', async () => {
    const user = userEvent.setup()
    const { container } = render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    const mobile = mobileScope(container)
    await user.type(mobile.getByPlaceholderText('Qty'), '2')

    expect(screen.getByText('Isi nama barang untuk setiap baris.')).toBeInTheDocument()
  })

  it('shows no hint and enables Simpan once the line is complete', async () => {
    const user = userEvent.setup()
    const { container } = render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    const mobile = mobileScope(container)
    await user.type(mobile.getByPlaceholderText('Nama barang...'), 'Kabel')
    await user.type(mobile.getByPlaceholderText('Qty'), '2')

    expect(screen.getByRole('button', { name: 'Simpan Pesanan' })).toBeEnabled()
    expect(screen.queryByText(/isi nama/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/isi jumlah/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/tambahkan minimal satu barang/i)).not.toBeInTheDocument()
  })
})
