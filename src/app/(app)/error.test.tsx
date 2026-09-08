// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AppError from './error'

/**
 * AppError had no coverage despite encoding a real Next 16.2 pitfall: it
 * must call `unstable_retry`, not `reset` (see CLAUDE.md's error.tsx note) —
 * `reset` alone would make "Coba Lagi" silently render the same failed RSC
 * payload, and `npm run build` doesn't type-check error.tsx's prop shape at
 * all, so nothing else here catches a regression back to `reset`.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

function makeError(digest?: string) {
  const error = new Error('boom') as Error & { digest?: string }
  if (digest) error.digest = digest
  return error
}

describe('AppError', () => {
  it('renders the error message', () => {
    render(<AppError error={makeError()} unstable_retry={vi.fn()} />)
    expect(screen.getByText('Terjadi kesalahan')).toBeInTheDocument()
    expect(
      screen.getByText('Data gagal dimuat. Periksa koneksi internet Anda, lalu coba lagi.')
    ).toBeInTheDocument()
  })

  it('logs the error to the console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = makeError()
    render(<AppError error={error} unstable_retry={vi.fn()} />)
    expect(consoleError).toHaveBeenCalledWith(error)
  })

  it('shows the digest code when present', () => {
    render(<AppError error={makeError('abc123')} unstable_retry={vi.fn()} />)
    expect(screen.getByText('Kode: abc123')).toBeInTheDocument()
  })

  it('does not show a digest line when absent', () => {
    render(<AppError error={makeError()} unstable_retry={vi.fn()} />)
    expect(screen.queryByText(/^Kode:/)).not.toBeInTheDocument()
  })

  it('calls unstable_retry, not reset, when "Coba Lagi" is clicked', async () => {
    const unstableRetry = vi.fn()
    const user = userEvent.setup()
    render(<AppError error={makeError()} unstable_retry={unstableRetry} />)

    await user.click(screen.getByRole('button', { name: 'Coba Lagi' }))

    expect(unstableRetry).toHaveBeenCalledTimes(1)
  })
})
