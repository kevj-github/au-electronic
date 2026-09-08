// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from './not-found'

describe('NotFound', () => {
  it('renders the not-found message and a link back to /pesanan', () => {
    render(<NotFound />)

    expect(screen.getByText('Halaman tidak ditemukan')).toBeInTheDocument()
    expect(
      screen.getByText('Halaman yang Anda cari tidak ada atau sudah dipindahkan.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Pesanan' })).toHaveAttribute(
      'href',
      '/pesanan'
    )
  })
})
