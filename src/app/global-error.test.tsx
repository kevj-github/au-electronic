// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GlobalError from './global-error'

/**
 * GlobalError had no coverage despite the same `unstable_retry`-not-`reset`
 * pitfall as (app)/error.tsx (see CLAUDE.md) — this is the last-resort
 * boundary for the root layout itself, so a regression here has no other
 * safety net at all.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

function makeError(digest?: string) {
  const error = new Error('boom') as Error & { digest?: string }
  if (digest) error.digest = digest
  return error
}

describe('GlobalError', () => {
  it('renders the error message', () => {
    render(<GlobalError error={makeError()} unstable_retry={vi.fn()} />)
    expect(screen.getByText('Terjadi kesalahan')).toBeInTheDocument()
    expect(
      screen.getByText('Aplikasi gagal dimuat. Coba muat ulang halaman.')
    ).toBeInTheDocument()
  })

  it('logs the error to the console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = makeError()
    render(<GlobalError error={error} unstable_retry={vi.fn()} />)
    expect(consoleError).toHaveBeenCalledWith(error)
  })

  it('shows the digest code when present', () => {
    render(<GlobalError error={makeError('xyz789')} unstable_retry={vi.fn()} />)
    expect(screen.getByText('Kode: xyz789')).toBeInTheDocument()
  })

  it('does not show a digest line when absent', () => {
    render(<GlobalError error={makeError()} unstable_retry={vi.fn()} />)
    expect(screen.queryByText(/^Kode:/)).not.toBeInTheDocument()
  })

  it('calls unstable_retry, not reset, when "Coba Lagi" is clicked', async () => {
    const unstableRetry = vi.fn()
    const user = userEvent.setup()
    render(<GlobalError error={makeError()} unstable_retry={unstableRetry} />)

    await user.click(screen.getByRole('button', { name: 'Coba Lagi' }))

    expect(unstableRetry).toHaveBeenCalledTimes(1)
  })
})
