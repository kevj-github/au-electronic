// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PesananNotFound from './not-found'

describe('PesananNotFound', () => {
  it('renders the not-found message and a link back to /pesanan', () => {
    render(<PesananNotFound />)

    expect(screen.getByText('Pesanan tidak ditemukan')).toBeInTheDocument()
    expect(
      screen.getByText('Pesanan ini mungkin sudah dihapus atau tautannya salah.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Pesanan' })).toHaveAttribute(
      'href',
      '/pesanan'
    )
  })
})
