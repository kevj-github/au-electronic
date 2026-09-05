import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewOrderFab } from './NewOrderFab'

const usePathname = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathname(),
}))

describe('NewOrderFab', () => {
  it('renders nothing on /pesanan', () => {
    usePathname.mockReturnValue('/pesanan')
    const { container } = render(<NewOrderFab role="owner" pesananLocked={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on /pesanan/baru', () => {
    usePathname.mockReturnValue('/pesanan/baru')
    const { container } = render(<NewOrderFab role="owner" pesananLocked={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders an active link for a helper when pesanan is not locked', () => {
    usePathname.mockReturnValue('/dashboard')
    render(<NewOrderFab role="helper" pesananLocked={false} />)

    const link = screen.getByRole('link', { name: 'Pesanan Baru' })
    expect(link).toHaveAttribute('href', '/pesanan/baru')
  })

  it('renders an active link for an owner even when pesanan is locked', () => {
    usePathname.mockReturnValue('/dashboard')
    render(<NewOrderFab role="owner" pesananLocked={true} />)

    const link = screen.getByRole('link', { name: 'Pesanan Baru' })
    expect(link).toHaveAttribute('href', '/pesanan/baru')
  })

  it('renders a disabled, keyboard-focusable button for a helper when pesanan is locked', () => {
    usePathname.mockReturnValue('/dashboard')
    render(<NewOrderFab role="helper" pesananLocked={true} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Pesanan Baru — dikunci oleh pemilik' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toHaveAttribute('disabled')
    expect(button).toHaveAccessibleName('Pesanan Baru — dikunci oleh pemilik')
  })
})
