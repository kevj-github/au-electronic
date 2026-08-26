import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders the given message', () => {
    render(<EmptyState message="Tidak ada pesanan yang cocok." />)

    expect(
      screen.getByText('Tidak ada pesanan yang cocok.'),
    ).toBeInTheDocument()
  })

  it('renders as a single paragraph element', () => {
    render(<EmptyState message="Belum ada data." />)

    const el = screen.getByText('Belum ada data.')
    expect(el.tagName).toBe('P')
  })
})
