import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderForm } from './OrderForm'

const backMock = vi.fn()
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}))

vi.mock('@/app/(app)/pesanan/actions', () => ({
  createPesanan: vi.fn(async () => ({ pesananId: 'p1' })),
}))

beforeEach(() => {
  backMock.mockClear()
  pushMock.mockClear()
})

function dispatchBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true })
  const notPrevented = window.dispatchEvent(event)
  return !notPrevented
}

describe('OrderForm unsaved-changes guard', () => {
  it('Batal navigates back immediately when the form is untouched', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: 'Batal' }))

    expect(backMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Batalkan pesanan ini?')).not.toBeInTheDocument()
  })

  it('Batal asks for confirmation once a line item has been added', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    await user.click(screen.getByRole('button', { name: 'Batal' }))

    expect(backMock).not.toHaveBeenCalled()
    expect(await screen.findByText('Batalkan pesanan ini?')).toBeInTheDocument()
  })

  it('"Tetap di Sini" cancels without navigating back', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    await user.click(screen.getByRole('button', { name: 'Batal' }))
    await screen.findByText('Batalkan pesanan ini?')

    await user.click(screen.getByRole('button', { name: 'Tetap di Sini' }))

    await waitFor(() =>
      expect(screen.queryByText('Batalkan pesanan ini?')).not.toBeInTheDocument()
    )
    expect(backMock).not.toHaveBeenCalled()
  })

  it('"Ya, Batalkan" confirms and navigates back', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    await user.click(screen.getByRole('button', { name: 'Batal' }))
    await screen.findByText('Batalkan pesanan ini?')

    await user.click(screen.getByRole('button', { name: 'Ya, Batalkan' }))

    expect(backMock).toHaveBeenCalledTimes(1)
  })

  it('warns on tab close once a line item has been added', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    expect(dispatchBeforeUnload()).toBe(false)

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))

    expect(dispatchBeforeUnload()).toBe(true)
  })

  it('does not warn on tab close for an empty, untouched form', () => {
    render(<OrderForm pelangganList={[]} isOwner />)
    expect(dispatchBeforeUnload()).toBe(false)
  })

  it('filling in a customer name alone also counts as unsaved', async () => {
    const user = userEvent.setup()
    render(<OrderForm pelangganList={[]} isOwner />)

    await user.type(screen.getByPlaceholderText('Nama pelanggan baru...'), 'Budi')

    expect(dispatchBeforeUnload()).toBe(true)
  })
})
