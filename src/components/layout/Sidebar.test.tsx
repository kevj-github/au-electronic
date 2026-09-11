// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'

const usePathname = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}))

describe('Sidebar', () => {
  it('renders only helper-permitted nav items for a helper', () => {
    usePathname.mockReturnValue('/pesanan')
    render(<Sidebar role="helper" nama="Budi" open onClose={vi.fn()} />)

    expect(screen.getByRole('link', { name: /Pesanan/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Pelanggan/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Dashboard/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Pengaturan/ })).not.toBeInTheDocument()
  })

  it('renders every nav item for an owner', () => {
    usePathname.mockReturnValue('/pesanan')
    render(<Sidebar role="owner" nama="Budi" open onClose={vi.fn()} />)

    for (const label of ['Pesanan', 'Pelanggan', 'Dashboard', 'Pengaturan']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('marks only the active route with aria-current', () => {
    usePathname.mockReturnValue('/pelanggan')
    render(<Sidebar role="owner" nama="Budi" open onClose={vi.fn()} />)

    expect(screen.getByRole('link', { name: 'Pelanggan' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Pesanan' })).not.toHaveAttribute('aria-current')
  })

  it("renders the user's name", () => {
    usePathname.mockReturnValue('/pesanan')
    render(<Sidebar role="owner" nama="Siti" open onClose={vi.fn()} />)

    expect(screen.getByText('Siti')).toBeInTheDocument()
  })

  it('shows the backdrop overlay only when open', () => {
    usePathname.mockReturnValue('/pesanan')
    const { rerender } = render(<Sidebar role="owner" nama="Budi" open onClose={vi.fn()} />)
    expect(document.querySelector('div.fixed.inset-0.z-30')).toBeInTheDocument()

    rerender(<Sidebar role="owner" nama="Budi" open={false} onClose={vi.fn()} />)
    expect(document.querySelector('div.fixed.inset-0.z-30')).not.toBeInTheDocument()
  })

  it('calls onClose when the backdrop is clicked', async () => {
    usePathname.mockReturnValue('/pesanan')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar role="owner" nama="Budi" open onClose={onClose} />)

    await user.click(document.querySelector('div.fixed.inset-0.z-30') as Element)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the mobile close button is clicked', async () => {
    usePathname.mockReturnValue('/pesanan')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar role="owner" nama="Budi" open onClose={onClose} />)

    await user.click(screen.getByLabelText('Tutup menu'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when a nav link is clicked', async () => {
    usePathname.mockReturnValue('/pesanan')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar role="owner" nama="Budi" open onClose={onClose} />)

    await user.click(screen.getByRole('link', { name: 'Pelanggan' }))
    expect(onClose).toHaveBeenCalled()
  })
})
