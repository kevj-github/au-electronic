// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PembayaranSection } from './PembayaranSection'
import type { PembayaranOwner } from '@/lib/types'

/**
 * `sisaTagihan === 0` does not by itself mean "Lunas" — an order whose items
 * have no price yet also has `sisaTagihan = 0`, so the "Belum ada harga" branch
 * (gated on `totalPesanan === 0 && pembayaranList.length === 0`) must win over
 * the "Lunas" branch in that case. See CLAUDE.md's PembayaranSection note.
 */

vi.mock('./PaymentModal', () => ({
  PaymentModal: ({ pesananId, sisaTagihan }: { pesananId: string; sisaTagihan: number }) => (
    <div data-testid="payment-modal" data-pesanan-id={pesananId} data-sisa={sisaTagihan} />
  ),
}))

vi.mock('./DeletePaymentButton', () => ({
  DeletePaymentButton: ({ pembayaranId }: { pembayaranId: string }) => (
    <button data-testid="delete-payment" data-pembayaran-id={pembayaranId} />
  ),
}))

const payment = (overrides: Partial<PembayaranOwner> = {}): PembayaranOwner => ({
  id: 'pay1',
  pesanan_id: 'p1',
  jumlah: 100000,
  metode: 'tunai',
  dibayar_pada: '2026-09-01T00:00:00Z',
  catatan: null,
  dicatat_oleh: 'u1',
  ...overrides,
})

describe('PembayaranSection', () => {
  it('shows "Belum ada harga" when there is no price and no payments yet', () => {
    render(
      <PembayaranSection
        pesananId="p1"
        totalPesanan={0}
        sisaTagihan={0}
        pembayaranList={[]}
      />
    )
    expect(screen.getByText('Belum ada harga')).toBeInTheDocument()
    expect(screen.queryByText('Lunas')).not.toBeInTheDocument()
  })

  it('shows "Lunas" when sisaTagihan is zero and there is a real total', () => {
    render(
      <PembayaranSection
        pesananId="p1"
        totalPesanan={100000}
        sisaTagihan={0}
        pembayaranList={[payment()]}
      />
    )
    expect(screen.getByText('Lunas')).toBeInTheDocument()
  })

  it('shows "Lunas" when there is no total but a payment already exists', () => {
    render(
      <PembayaranSection
        pesananId="p1"
        totalPesanan={0}
        sisaTagihan={0}
        pembayaranList={[payment()]}
      />
    )
    expect(screen.getByText('Lunas')).toBeInTheDocument()
    expect(screen.queryByText('Belum ada harga')).not.toBeInTheDocument()
  })

  it('shows the formatted outstanding balance when there is a positive sisaTagihan', () => {
    render(
      <PembayaranSection
        pesananId="p1"
        totalPesanan={500000}
        sisaTagihan={250000}
        pembayaranList={[payment()]}
      />
    )
    expect(screen.getByText('Rp 250.000')).toBeInTheDocument()
  })

  it('renders PaymentModal only when sisaTagihan is greater than zero', () => {
    const { rerender } = render(
      <PembayaranSection pesananId="p1" totalPesanan={500000} sisaTagihan={0} pembayaranList={[payment()]} />
    )
    expect(screen.queryByTestId('payment-modal')).not.toBeInTheDocument()

    rerender(
      <PembayaranSection pesananId="p1" totalPesanan={500000} sisaTagihan={100000} pembayaranList={[]} />
    )
    expect(screen.getByTestId('payment-modal')).toBeInTheDocument()
  })

  it('shows "Belum ada pembayaran" when the payment list is empty', () => {
    render(
      <PembayaranSection pesananId="p1" totalPesanan={0} sisaTagihan={0} pembayaranList={[]} />
    )
    expect(screen.getByText('Belum ada pembayaran.')).toBeInTheDocument()
  })

  it('lists each payment with its amount and a delete button', () => {
    render(
      <PembayaranSection
        pesananId="p1"
        totalPesanan={200000}
        sisaTagihan={0}
        pembayaranList={[
          payment({ id: 'pay1', jumlah: 150000, metode: 'tunai' }),
          payment({ id: 'pay2', jumlah: 50000, metode: 'transfer', catatan: 'DP' }),
        ]}
      />
    )
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 50.000')).toBeInTheDocument()
    expect(screen.getByText(/DP/)).toBeInTheDocument()
    const deleteButtons = screen.getAllByTestId('delete-payment')
    expect(deleteButtons).toHaveLength(2)
    expect(deleteButtons[0]).toHaveAttribute('data-pembayaran-id', 'pay1')
    expect(deleteButtons[1]).toHaveAttribute('data-pembayaran-id', 'pay2')
  })
})
