import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrderLineItem, OrderLineItemCard, type LineItem } from './OrderLineItem'

const item: LineItem = {
  id: 'x1',
  nama_barang: 'Kabel',
  qty: '3',
  harga_satuan: '1000',
}

function renderRow(props: Partial<Parameters<typeof OrderLineItem>[0]> = {}) {
  const onChange = vi.fn()
  const onRemove = vi.fn()
  render(
    <table>
      <tbody>
        <OrderLineItem item={item} isOwner onChange={onChange} onRemove={onRemove} {...props} />
      </tbody>
    </table>,
  )
  return { onChange, onRemove }
}

describe('OrderLineItem (desktop row)', () => {
  it('shows the computed subtotal', () => {
    renderRow()
    expect(screen.getByText('Rp 3.000')).toBeInTheDocument()
  })

  it('treats a non-numeric qty/harga as zero in the subtotal', () => {
    renderRow({ item: { ...item, qty: '', harga_satuan: 'abc' } })
    expect(screen.getByText('Rp 0')).toBeInTheDocument()
  })

  it('calls onChange with the field patch on qty edit', async () => {
    const { onChange } = renderRow()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Qty Kabel'), '5')
    expect(onChange).toHaveBeenCalledWith('x1', { qty: '35' })
  })

  it('calls onChange with the field patch on nama_barang edit', async () => {
    const { onChange } = renderRow()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nama barang'), '!')
    expect(onChange).toHaveBeenCalledWith('x1', { nama_barang: 'Kabel!' })
  })

  it('calls onRemove with the item id', async () => {
    const { onRemove } = renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Hapus Kabel'))
    expect(onRemove).toHaveBeenCalledWith('x1')
  })

  it('disables the price field and shows a hint for non-owners', () => {
    renderRow({ isOwner: false })
    expect(screen.getByLabelText('Harga satuan Kabel')).toBeDisabled()
    expect(screen.getByText('Diisi oleh pemilik nanti')).toBeInTheDocument()
  })

  it('leaves the price field enabled for owners with no hint text', () => {
    renderRow({ isOwner: true })
    expect(screen.getByLabelText('Harga satuan Kabel')).not.toBeDisabled()
    expect(screen.queryByText('Diisi oleh pemilik nanti')).not.toBeInTheDocument()
  })
})

function renderCard(props: Partial<Parameters<typeof OrderLineItemCard>[0]> = {}) {
  const onChange = vi.fn()
  const onRemove = vi.fn()
  render(<OrderLineItemCard item={item} isOwner onChange={onChange} onRemove={onRemove} {...props} />)
  return { onChange, onRemove }
}

describe('OrderLineItemCard (mobile card)', () => {
  it('shows the computed subtotal', () => {
    renderCard()
    expect(screen.getByText('Rp 3.000')).toBeInTheDocument()
  })

  it('calls onChange with the field patch on harga_satuan edit', async () => {
    const { onChange } = renderCard()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Harga satuan Kabel'), '5')
    expect(onChange).toHaveBeenCalledWith('x1', { harga_satuan: '10005' })
  })

  it('calls onRemove with the item id', async () => {
    const { onRemove } = renderCard()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Hapus Kabel'))
    expect(onRemove).toHaveBeenCalledWith('x1')
  })

  it('hides the price input and shows a hint for non-owners', () => {
    renderCard({ isOwner: false })
    expect(screen.queryByLabelText('Harga satuan Kabel')).not.toBeInTheDocument()
    expect(screen.getByText('Diisi oleh pemilik nanti')).toBeInTheDocument()
  })
})
