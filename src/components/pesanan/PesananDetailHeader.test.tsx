// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PesananDetailHeader } from './PesananDetailHeader'
import type { InvoiceData } from '@/lib/invoice-data'

vi.mock('./TanggalPengirimanEditor', () => ({
  TanggalPengirimanEditor: () => <div data-testid="tanggal-editor" />,
}))
vi.mock('./PengirimanEditor', () => ({
  PengirimanEditor: () => <div data-testid="pengiriman-editor" />,
}))
vi.mock('./CollyEditor', () => ({
  CollyEditor: () => <div data-testid="colly-editor" />,
}))
vi.mock('./StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}))
vi.mock('./StatusTransitionButtons', () => ({
  StatusTransitionButtons: () => <div data-testid="status-transition" />,
}))
vi.mock('./DocumentButtons', () => ({
  DocumentButtons: () => <div data-testid="document-buttons" />,
}))

const invoiceData = {} as InvoiceData

const baseProps = {
  pesananId: 'p1',
  kodePesanan: 'A-001',
  status: 'diproses' as const,
  createdAt: '2026-09-01T00:00:00Z',
  tanggalPengiriman: null,
  pengiriman: null,
  colly: null,
  belumDicekCount: 0,
  nextStatuses: [],
}

describe('PesananDetailHeader', () => {
  it('shows the kode and status for everyone', () => {
    render(<PesananDetailHeader {...baseProps} isOwner={false} statusLocked={false} invoiceData={null} />)
    expect(screen.getByText('A-001')).toBeInTheDocument()
    expect(screen.getByTestId('status-badge')).toHaveTextContent('diproses')
  })

  it('hides the shipping editors, document buttons and status transitions from a helper', () => {
    render(<PesananDetailHeader {...baseProps} isOwner={false} statusLocked={false} invoiceData={invoiceData} />)
    expect(screen.queryByTestId('tanggal-editor')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pengiriman-editor')).not.toBeInTheDocument()
    expect(screen.queryByTestId('colly-editor')).not.toBeInTheDocument()
    expect(screen.queryByTestId('document-buttons')).not.toBeInTheDocument()
    expect(screen.queryByTestId('status-transition')).not.toBeInTheDocument()
  })

  it('shows the shipping editors and status transitions to an owner', () => {
    render(<PesananDetailHeader {...baseProps} isOwner={true} statusLocked={false} invoiceData={null} />)
    expect(screen.getByTestId('tanggal-editor')).toBeInTheDocument()
    expect(screen.getByTestId('pengiriman-editor')).toBeInTheDocument()
    expect(screen.getByTestId('colly-editor')).toBeInTheDocument()
    expect(screen.getByTestId('status-transition')).toBeInTheDocument()
  })

  it('shows document buttons to an owner only when invoiceData is present', () => {
    const { rerender } = render(
      <PesananDetailHeader {...baseProps} isOwner={true} statusLocked={false} invoiceData={null} />
    )
    expect(screen.queryByTestId('document-buttons')).not.toBeInTheDocument()

    rerender(<PesananDetailHeader {...baseProps} isOwner={true} statusLocked={false} invoiceData={invoiceData} />)
    expect(screen.getByTestId('document-buttons')).toBeInTheDocument()
  })
})
