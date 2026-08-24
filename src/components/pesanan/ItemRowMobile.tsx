'use client'

import type { RefObject } from 'react'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import { ItemChecklistCheckbox } from './ItemChecklistCheckbox'
import { HelperItemChecklist } from './HelperItemChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatRupiah, formatThousandsInput } from '@/lib/utils'
import type { EditState, SectionItem } from './itemsSectionShared'

interface ItemRowMobileProps {
  item: SectionItem
  isOwner: boolean
  isLocked: boolean
  priceEditable: boolean
  isEditing: boolean
  editState: EditState
  editQtyRef: RefObject<HTMLInputElement | null>
  editNamaRef: RefObject<HTMLInputElement | null>
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

export function ItemRowMobile({
  item,
  isOwner,
  isLocked,
  priceEditable,
  isEditing,
  editState,
  editQtyRef,
  editNamaRef,
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
}: ItemRowMobileProps) {
  return (
    <div className="border rounded-lg p-3">
      {isEditing ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              ref={editQtyRef}
              type="number"
              min="1"
              value={editState.qty}
              onChange={(e) => onEditQtyChange(e.target.value)}
              className="h-8 w-20 text-sm text-right"
              aria-label="Qty"
              enterKeyHint="next"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); editNamaRef.current?.focus() }
              }}
            />
            <Input
              ref={editNamaRef}
              value={editState.nama_barang}
              onChange={(e) => onEditNamaChange(e.target.value)}
              placeholder="Nama barang"
              className="h-8 text-sm flex-1"
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onSaveEdit() }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSaveEdit} disabled={isLoading}>
              <Check className="size-3.5 mr-1" />Simpan
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelEdit}>
              <X className="size-3.5 mr-1" />Batal
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            {/* Owner's checkbox — front, owner only */}
            {isOwner && (
              <div className="pt-0.5">
                <ItemChecklistCheckbox
                  itemId={item.id}
                  checked={item.dicek_oleh_owner ?? false}
                  kind="owner"
                  label="Dicek pemilik"
                  showLabel={false}
                  disabled={isLocked}
                />
              </div>
            )}

            {/* Qty and Nama */}
            <p className="text-sm font-medium flex-1 min-w-0 break-words pt-0.5">
              {item.qty}× {item.nama_barang}
            </p>

            {/* Helper's checklist — back */}
            <HelperItemChecklist
              itemId={item.id}
              qty={item.qty}
              jumlahDiambil={item.jumlah_diambil}
              disabled={isLocked}
            />

            {/* Edit / Delete */}
            {!isLocked && (
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={onStartEdit}
                  aria-label="Edit item"
                >
                  <Pencil className="size-3.5" />
                </Button>
                {isDeleting ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      onClick={onConfirmDelete}
                      disabled={isLoading}
                    >
                      Hapus
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={onCancelDelete}
                      aria-label="Batal hapus"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    onClick={onStartDelete}
                    aria-label="Hapus item"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Price + subtotal — owner only */}
          {isOwner && (
            <div className="mt-2 pt-2 border-t space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Harga Satuan</span>
                {priceEditable ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatThousandsInput(rawPriceValue)}
                    onChange={(e) => onPriceChange(e.target.value)}
                    onBlur={onPriceBlur}
                    disabled={isSavingPrice}
                    className="h-8 w-32 text-right font-mono text-sm"
                    aria-label={`Harga satuan ${item.nama_barang}`}
                  />
                ) : (
                  <span className="font-mono text-sm">{formatRupiah(numPriceValue)}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Subtotal</span>
                <span className="font-mono text-sm font-medium">{formatRupiah(subtotalValue)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
