// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrderRowCard, OrderRowTableRow } from './OrderListRow'
import type { OrderRow } from './order-row'

const deletePesananIds: string[] = []
vi.mock('./DeletePesananButton', () => ({
  DeletePesananButton: ({ pesananId }: { pesananId: string }) => {
    deletePesananIds.push(pesananId)
    return <button data-testid="delete-pesanan">delete</button>
  },
}))

beforeEach(() => {
  deletePesananIds.length = 0
})

function row(overrides: {
  pelanggan?: OrderRow['p']['pelanggan']
  nama_pelanggan?: string | null
  tanggal_pengiriman?: string | null
  view?: Partial<OrderRow['view']>
} = {}): OrderRow {
  return {
    p: {
      id: 'p1',
      kode_pesanan: 'AU.2026.09.00001',
      status: 'diproses',
      created_at: '2026-09-01T00:00:00.000Z',
      nama_pelanggan:
        'nama_pelanggan' in overrides ? overrides.nama_pelanggan! : 'Fallback Nama',
      pelanggan:
        'pelanggan' in overrides
          ? overrides.pelanggan!
          : { nama: 'Toko Satu', alamat: 'Jl. Mawar 1' },
      tanggal_pengiriman: overrides.tanggal_pengiriman ?? null,
    },
    view: {
      diambilCount: 1,
      totalItems: 3,
      totalPesanan: 50000,
      totalDibayar: 20000,
      sisaTagihan: 30000,
      tagihan: { kind: 'sisa', amount: 30000 },
      ...overrides.view,
    },
  }
}

describe('OrderRowCard', () => {
  it('renders the code, customer name, address, date, and links to the detail page', () => {
    render(<OrderRowCard row={row()} isOwner={false} />)

    expect(screen.getByText('AU.2026.09.00001')).toBeInTheDocument()
    expect(screen.getByText('Toko Satu')).toBeInTheDocument()
    expect(screen.getByText('Jl. Mawar 1')).toBeInTheDocument()
    expect(screen.getByText('1 Sep 2026')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/pesanan/p1')
  })

  it('falls back to nama_pelanggan when there is no linked pelanggan', () => {
    render(<OrderRowCard row={row({ pelanggan: null, nama_pelanggan: 'Toko Lama' })} isOwner={false} />)

    expect(screen.getByText('Toko Lama')).toBeInTheDocument()
  })

  it('shows "—" when neither pelanggan nor nama_pelanggan is available', () => {
    render(<OrderRowCard row={row({ pelanggan: null, nama_pelanggan: null })} isOwner={false} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('omits the address line when the pelanggan has no alamat', () => {
    render(
      <OrderRowCard
        row={row({ pelanggan: { nama: 'Toko Satu', alamat: null } })}
        isOwner={false}
      />
    )

    expect(screen.getByText('Toko Satu')).toBeInTheDocument()
    expect(screen.queryByText('Jl. Mawar 1')).not.toBeInTheDocument()
  })

  it('shows the diambil count instead of tagihan/pengiriman/delete for a helper', () => {
    render(<OrderRowCard row={row()} isOwner={false} />)

    expect(screen.getByText('1/3 diambil')).toBeInTheDocument()
    expect(screen.queryByText(/Pengiriman:/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-pesanan')).not.toBeInTheDocument()
  })

  it('shows tagihan, pengiriman, and the delete button for an owner', () => {
    render(<OrderRowCard row={row({ tanggal_pengiriman: '2026-09-10T00:00:00.000Z' })} isOwner />)

    expect(screen.getByText('Rp 30.000')).toBeInTheDocument()
    expect(screen.getByText('10 Sep 2026')).toBeInTheDocument()
    expect(screen.getByTestId('delete-pesanan')).toBeInTheDocument()
    expect(deletePesananIds).toEqual(['p1'])
  })

  it('shows "Belum ditentukan" for an owner when tanggal_pengiriman is unset', () => {
    render(<OrderRowCard row={row({ tanggal_pengiriman: null })} isOwner />)

    expect(screen.getByText('Belum ditentukan')).toBeInTheDocument()
  })

  it.each([
    [{ kind: 'belum-ada-harga' as const }, 'Belum ada harga'],
    [{ kind: 'lunas' as const }, 'Lunas'],
  ])('renders the %o tagihan state as "%s"', (tagihan, expectedText) => {
    render(<OrderRowCard row={row({ view: { tagihan } })} isOwner />)

    expect(screen.getByText(expectedText)).toBeInTheDocument()
  })
})

describe('OrderRowTableRow', () => {
  function renderRow(r: OrderRow, isOwner: boolean) {
    return render(
      <table>
        <tbody>
          <OrderRowTableRow row={r} isOwner={isOwner} />
        </tbody>
      </table>
    )
  }

  it('renders the code as a link and the customer name/address', () => {
    renderRow(row(), false)

    const link = screen.getByRole('link', { name: 'AU.2026.09.00001' })
    expect(link).toHaveAttribute('href', '/pesanan/p1')
    expect(screen.getByText('Toko Satu')).toBeInTheDocument()
    expect(screen.getByText('Jl. Mawar 1')).toBeInTheDocument()
  })

  it('omits the pengiriman column, total, and delete cell for a helper, showing diambil count instead', () => {
    renderRow(row({ tanggal_pengiriman: '2026-09-10T00:00:00.000Z' }), false)

    expect(screen.queryByText('10 Sep 2026')).not.toBeInTheDocument()
    expect(screen.queryByText('Rp 50.000')).not.toBeInTheDocument()
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.queryByTestId('delete-pesanan')).not.toBeInTheDocument()
  })

  it('shows the pengiriman date, total, tagihan and delete cell for an owner', () => {
    renderRow(row({ tanggal_pengiriman: '2026-09-10T00:00:00.000Z' }), true)

    expect(screen.getByText('10 Sep 2026')).toBeInTheDocument()
    expect(screen.getByText('Rp 50.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 30.000')).toBeInTheDocument()
    expect(screen.getByTestId('delete-pesanan')).toBeInTheDocument()
  })

  it('shows an italic "Belum ditentukan" for an owner when tanggal_pengiriman is unset', () => {
    renderRow(row({ tanggal_pengiriman: null }), true)

    expect(screen.getByText('Belum ditentukan')).toBeInTheDocument()
  })

  it('renders the status badge', () => {
    renderRow(row(), true)

    expect(screen.getByText('Diproses')).toBeInTheDocument()
  })
})
