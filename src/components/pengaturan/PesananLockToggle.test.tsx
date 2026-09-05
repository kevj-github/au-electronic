import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PesananLockToggle } from './PesananLockToggle'
import { setPesananLocked } from '@/app/(app)/pengaturan/actions'

vi.mock('@/app/(app)/pengaturan/actions', () => ({
  setPesananLocked: vi.fn(),
}))

const mockSetLocked = vi.mocked(setPesananLocked)

beforeEach(() => {
  mockSetLocked.mockReset()
})

describe('PesananLockToggle', () => {
  it('shows the unlocked copy and a "Kunci" action button when not locked', () => {
    render(<PesananLockToggle locked={false} />)
    expect(screen.getByText('Helper dapat membuat pesanan baru.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kunci/ })).toBeInTheDocument()
  })

  it('shows the locked copy and a "Buka Kunci" action button when locked', () => {
    render(<PesananLockToggle locked={true} />)
    expect(screen.getByText('Helper tidak dapat membuat pesanan baru saat ini.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buka Kunci/ })).toBeInTheDocument()
  })

  it('flips immediately on click, before the action resolves', async () => {
    let resolveAction: (v: { error?: string }) => void = () => {}
    mockSetLocked.mockImplementation(() => new Promise((resolve) => { resolveAction = resolve }))
    const user = userEvent.setup()

    render(<PesananLockToggle locked={false} />)
    await user.click(screen.getByRole('button', { name: /Kunci/ }))

    expect(screen.getByRole('button', { name: /Buka Kunci/ })).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
    expect(mockSetLocked).toHaveBeenCalledWith(true)

    resolveAction({})
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
  })

  it('reverts to the previous state and shows an error when the action fails', async () => {
    mockSetLocked.mockResolvedValue({ error: 'Gagal menyimpan.' })
    const user = userEvent.setup()

    render(<PesananLockToggle locked={false} />)
    await user.click(screen.getByRole('button', { name: /Kunci/ }))

    expect(await screen.findByText('Gagal menyimpan.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kunci/ })).toBeInTheDocument()
  })

  it('clears a previous error on the next attempt', async () => {
    mockSetLocked.mockResolvedValueOnce({ error: 'Gagal menyimpan.' })
    const user = userEvent.setup()

    render(<PesananLockToggle locked={false} />)
    await user.click(screen.getByRole('button', { name: /Kunci/ }))
    expect(await screen.findByText('Gagal menyimpan.')).toBeInTheDocument()

    mockSetLocked.mockResolvedValueOnce({})
    await user.click(screen.getByRole('button', { name: /Kunci/ }))
    expect(screen.queryByText('Gagal menyimpan.')).not.toBeInTheDocument()
  })

  it('resyncs to a fresh locked prop (e.g. from RealtimeRefresh on another device)', () => {
    const { rerender } = render(<PesananLockToggle locked={false} />)
    expect(screen.getByRole('button', { name: /Kunci/ })).toBeInTheDocument()

    rerender(<PesananLockToggle locked={true} />)
    expect(screen.getByRole('button', { name: /Buka Kunci/ })).toBeInTheDocument()
  })
})
