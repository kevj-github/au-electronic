// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardDateFilter } from './DashboardDateFilter'

/**
 * Local state + push-on-blur (not push-on-change) is the fix for the race
 * where two URL-param inputs each pushing immediately on change would
 * clobber each other, per CLAUDE.md's DashboardDateFilter note.
 */

const push = vi.fn()
let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}))

beforeEach(() => {
  push.mockClear()
  searchParams = new URLSearchParams()
})

describe('DashboardDateFilter', () => {
  it('starts with empty fields and no Reset button when there are no params', () => {
    render(<DashboardDateFilter />)
    expect(screen.getByLabelText('Dari tanggal')).toHaveValue('')
    expect(screen.getByLabelText('Sampai tanggal')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })

  it('pre-fills fields from existing from/to params', () => {
    searchParams = new URLSearchParams({ from: '2026-09-01', to: '2026-09-09' })
    render(<DashboardDateFilter />)
    expect(screen.getByLabelText('Dari tanggal')).toHaveValue('2026-09-01')
    expect(screen.getByLabelText('Sampai tanggal')).toHaveValue('2026-09-09')
  })

  it('does not push on change, only on blur', async () => {
    const user = userEvent.setup()
    render(<DashboardDateFilter />)

    const from = screen.getByLabelText('Dari tanggal')
    await user.type(from, '2026-09-01')

    expect(push).not.toHaveBeenCalled()
  })

  it('pushes only the field that was blurred, per the current local state', async () => {
    const user = userEvent.setup()
    render(<DashboardDateFilter />)

    const from = screen.getByLabelText('Dari tanggal')
    await user.type(from, '2026-09-01')
    await user.tab()

    expect(push).toHaveBeenCalledWith('/dashboard?from=2026-09-01')
  })

  it('pushes both params once each field has been filled and blurred', async () => {
    const user = userEvent.setup()
    render(<DashboardDateFilter />)

    await user.type(screen.getByLabelText('Dari tanggal'), '2026-09-01')
    await user.click(screen.getByLabelText('Sampai tanggal'))
    await user.type(screen.getByLabelText('Sampai tanggal'), '2026-09-09')
    await user.tab()

    expect(push).toHaveBeenLastCalledWith('/dashboard?from=2026-09-01&to=2026-09-09')
  })

  it('pushes the bare path when both fields are cleared', async () => {
    searchParams = new URLSearchParams({ from: '2026-09-01' })
    const user = userEvent.setup()
    render(<DashboardDateFilter />)

    const from = screen.getByLabelText('Dari tanggal')
    await user.clear(from)
    await user.tab()

    expect(push).toHaveBeenCalledWith('/dashboard')
  })

  it('reset clears both fields and pushes the bare dashboard path', async () => {
    searchParams = new URLSearchParams({ from: '2026-09-01', to: '2026-09-09' })
    const user = userEvent.setup()
    render(<DashboardDateFilter />)

    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByLabelText('Dari tanggal')).toHaveValue('')
    expect(screen.getByLabelText('Sampai tanggal')).toHaveValue('')
    expect(push).toHaveBeenCalledWith('/dashboard')
  })
})
