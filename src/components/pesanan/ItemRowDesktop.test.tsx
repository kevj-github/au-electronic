import { createRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemRowDesktop } from './ItemRowDesktop'
import type { EditState, SectionItem } from './itemsSectionShared'

vi.mock('@/app/(app)/pesanan/item-mutation-actions', () => ({
  toggleItemDicekOwner: vi.fn(async () => ({})),
  setItemJumlahDiambil: vi.fn(async () => ({})),
}))

const item: SectionItem = {
  id: 'i1',
  nama_barang: 'Kabel',
  qty: 3,
  jumlah_diambil: 0,
  dicek_oleh_owner: false,
  harga_satuan: 1000,
  subtotal: 3000,
}

const emptyEdit: EditState = { nama_barang: '', qty: '' }

function renderRow(props: Partial<Parameters<typeof ItemRowDesktop>[0]> = {}) {
  const handlers = {
    onEditQtyChange: vi.fn(),
    onEditNamaChange: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onStartEdit: vi.fn(),
    onStartDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    onPriceChange: vi.fn(),
    onPriceBlur: vi.fn(),
  }
  render(
    <table>
      <tbody>
        <ItemRowDesktop
          item={item}
          isOwner
          isLocked={false}
          priceEditable
          isEditing={false}
          editState={emptyEdit}
          totalCols={6}
          editQtyRef={createRef<HTMLInputElement>()}
          isDeleting={false}
          isLoading={false}
          rawPriceValue="1000"
          numPriceValue={1000}
          subtotalValue={3000}
          isSavingPrice={false}
          {...handlers}
          {...props}
        />
      </tbody>
    </table>
  )
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ItemRowDesktop', () => {
  describe('editing mode', () => {
    it('renders qty/nama inputs from editState and wires their onChange', async () => {
      const user = userEvent.setup()
      const { onEditQtyChange, onEditNamaChange } = renderRow({
        isEditing: true,
        editState: { nama_barang: 'Kabel', qty: '3' },
      })

      expect(screen.getByLabelText('Qty')).toHaveValue(3)
      expect(screen.getByPlaceholderText('Nama barang')).toHaveValue('Kabel')

      await user.type(screen.getByLabelText('Qty'), '5')
      expect(onEditQtyChange).toHaveBeenCalled()

      await user.type(screen.getByPlaceholderText('Nama barang'), '!')
      expect(onEditNamaChange).toHaveBeenCalled()
    })

    it('calls onSaveEdit with the item id and onCancelEdit', async () => {
      const user = userEvent.setup()
      const { onSaveEdit, onCancelEdit } = renderRow({ isEditing: true })

      await user.click(screen.getByText('Simpan'))
      expect(onSaveEdit).toHaveBeenCalledWith('i1')

      await user.click(screen.getByLabelText('Batal edit'))
      expect(onCancelEdit).toHaveBeenCalled()
    })

    it('disables Simpan while isLoading', () => {
      renderRow({ isEditing: true, isLoading: true })
      expect(screen.getByText('Simpan')).toBeDisabled()
    })
  })

  describe('owner columns', () => {
    it('shows the owner checkbox, editable price input and subtotal for owners', () => {
      renderRow({ isOwner: true })
      expect(screen.getByLabelText('Dicek pemilik')).toBeInTheDocument()
      expect(screen.getByLabelText('Harga satuan Kabel')).toHaveValue('1.000')
      expect(screen.getByText('Rp 3.000')).toBeInTheDocument()
    })

    it('shows a plain formatted price instead of an input when priceEditable is false', () => {
      renderRow({ isOwner: true, priceEditable: false })
      expect(screen.queryByLabelText('Harga satuan Kabel')).not.toBeInTheDocument()
      expect(screen.getByText('Rp 1.000')).toBeInTheDocument()
    })

    it('fires onPriceChange/onPriceBlur for the price input', async () => {
      const user = userEvent.setup()
      const { onPriceChange, onPriceBlur } = renderRow({ isOwner: true })

      const priceInput = screen.getByLabelText('Harga satuan Kabel')
      await user.type(priceInput, '5')
      expect(onPriceChange).toHaveBeenCalledWith('i1', expect.any(String))

      await user.tab()
      expect(onPriceBlur).toHaveBeenCalledWith(item)
    })

    it('hides owner checkbox, price and subtotal columns for non-owners', () => {
      renderRow({ isOwner: false })
      expect(screen.queryByLabelText('Dicek pemilik')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Harga satuan Kabel')).not.toBeInTheDocument()
      expect(screen.queryByText('Rp 3.000')).not.toBeInTheDocument()
    })
  })

  describe('edit/delete actions', () => {
    it('hides the actions column entirely when locked', () => {
      renderRow({ isLocked: true })
      expect(screen.queryByLabelText('Edit item')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Hapus item')).not.toBeInTheDocument()
    })

    it('calls onStartEdit with the item on edit click', async () => {
      const user = userEvent.setup()
      const { onStartEdit } = renderRow()
      await user.click(screen.getByLabelText('Edit item'))
      expect(onStartEdit).toHaveBeenCalledWith(item)
    })

    it('calls onStartDelete then shows confirm/cancel, wiring both callbacks', async () => {
      const user = userEvent.setup()
      const { onStartDelete } = renderRow()
      await user.click(screen.getByLabelText('Hapus item'))
      expect(onStartDelete).toHaveBeenCalledWith('i1')
    })

    it('renders confirm/cancel delete controls when isDeleting', async () => {
      const user = userEvent.setup()
      const { onConfirmDelete, onCancelDelete } = renderRow({ isDeleting: true })

      expect(screen.queryByLabelText('Hapus item')).not.toBeInTheDocument()
      await user.click(screen.getByText('Hapus?'))
      expect(onConfirmDelete).toHaveBeenCalledWith('i1')

      await user.click(screen.getByLabelText('Batal hapus'))
      expect(onCancelDelete).toHaveBeenCalled()
    })

    it('disables the confirm-delete button while isLoading', () => {
      renderRow({ isDeleting: true, isLoading: true })
      expect(screen.getByText('Hapus?')).toBeDisabled()
    })
  })
})
