'use client'

import type { RefObject } from 'react'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import { ItemChecklistCheckbox } from './ItemChecklistCheckbox'
import { HelperItemChecklist } from './HelperItemChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatRupiah, formatThousandsInput } from '@/lib/utils'
import type { EditState, SectionItem } from './itemsSectionShared'

interface ItemRowDesktopProps {
  item: SectionItem
  isOwner: boolean
  isLocked: boolean
  priceEditable: boolean
  isEditing: boolean
  editState: EditState
  totalCols: number
  editQtyRef: RefObject<HTMLInputElement | null>
  onEditQtyChange: (value: string) => void
  onEditNamaChange: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  isDeleting: boolean
  onStartEdit: () => void
  onStartDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  isLoading: boolean
  rawPriceValue: string
  numPriceValue: number
  subtotalValue: number
  isSavingPrice: boolean
  onPriceChange: (value: string) => void
  onPriceBlur: () => void
}

export function ItemRowDesktop({
  item,
  isOwner,
  isLocked,
  priceEditable,
  isEditing,
  editState,
  totalCols,
  editQtyRef,
  onEditQtyChange,
  onEditNamaChange,
  onSaveEdit,
  onCancelEdit,
  isDeleting,
  onStartEdit,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
  isLoading,
  rawPriceValue,
  numPriceValue,
  subtotalValue,
  isSavingPrice,
  onPriceChange,
  onPriceBlur,
}: ItemRowDesktopProps) {
  if (isEditing) {
    return (
      <tr>
        <td className="px-4 py-2" colSpan={totalCols}>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              ref={editQtyRef}
              type="number"
              min="1"
              value={editState.qty}
              onChange={(e) => onEditQtyChange(e.target.value)}
              className="h-8 w-20 text-sm text-right"
              aria-label="Qty"
              autoFocus
            />
            <Input
              value={editState.nama_barang}
              onChange={(e) => onEditNamaChange(e.target.value)}
              className="h-8 text-sm flex-1 min-w-[160px]"
              placeholder="Nama barang"
            />
            <Button size="sm" onClick={onSaveEdit} disabled={isLoading}>
              <Check className="size-3.5 mr-1" />Simpan
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit} aria-label="Batal edit">
              <X className="size-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      {isOwner && (
        <td className="px-3 py-2 text-center align-middle">
          <ItemChecklistCheckbox
            itemId={item.id}
            checked={item.dicek_oleh_owner ?? false}
            kind="owner"
            label="Dicek pemilik"
            showLabel={false}
            disabled={isLocked}
          />
        </td>
      )}
      <td className="px-4 py-2 text-right align-middle">{item.qty}</td>
      <td className="px-4 py-2 align-middle">{item.nama_barang}</td>
      {isOwner && (
        <td className="px-4 py-2 text-right align-middle">
          {priceEditable ? (
            <Input
              type="text"
              inputMode="numeric"
              value={formatThousandsInput(rawPriceValue)}
              onChange={(e) => onPriceChange(e.target.value)}
              onBlur={onPriceBlur}
              disabled={isSavingPrice}
              className="h-8 w-36 ml-auto text-right font-mono text-sm"
              aria-label={`Harga satuan ${item.nama_barang}`}
            />
          ) : (
            <span className="font-mono">{formatRupiah(numPriceValue)}</span>
          )}
        </td>
      )}
      {isOwner && (
        <td className="px-4 py-2 text-right align-middle font-mono">{formatRupiah(subtotalValue)}</td>
      )}
      <td className="px-3 py-2 text-center align-middle">
        <HelperItemChecklist
          itemId={item.id}
          qty={item.qty}
          jumlahDiambil={item.jumlah_diambil}
          disabled={isLocked}
        />
      </td>
      {!isLocked && (
        <td className="px-4 py-2 align-middle">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onStartEdit}
              className="p-1 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground"
              aria-label="Edit item"
            >
              <Pencil className="size-3.5" />
            </button>
            {isDeleting ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 px-1.5 text-xs"
                  onClick={onConfirmDelete}
                  disabled={isLoading}
                >
                  Hapus?
                </Button>
                <button
                  type="button"
                  onClick={onCancelDelete}
                  className="p-1 rounded hover:bg-gray-100 text-muted-foreground"
                  aria-label="Batal hapus"
                >
                  <X className="size-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartDelete}
                className="p-1 rounded hover:bg-gray-100 text-red-400 hover:text-red-600"
                aria-label="Hapus item"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}
