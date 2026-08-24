'use client'

import type { RefObject } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EditState } from './itemsSectionShared'

interface AddItemFormDesktopProps {
  addingNew: boolean
  newItem: EditState
  newQtyRef: RefObject<HTMLInputElement | null>
  totalCols: number
  onQtyChange: (value: string) => void
  onNamaChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  onStartAdding: () => void
  isSaving: boolean
}

export function AddItemFormDesktop({
  addingNew,
  newItem,
  newQtyRef,
  totalCols,
  onQtyChange,
  onNamaChange,
  onSave,
  onCancel,
  onStartAdding,
  isSaving,
}: AddItemFormDesktopProps) {
  if (!addingNew) {
    return (
      <tr>
        <td colSpan={totalCols} className="px-4 py-2">
          <button
            type="button"
            onClick={onStartAdding}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Tambah barang
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="px-4 py-2" colSpan={totalCols}>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            ref={newQtyRef}
            type="number"
            min="1"
            value={newItem.qty}
            onChange={(e) => onQtyChange(e.target.value)}
            placeholder="Qty"
            className="h-8 w-20 text-sm text-right"
            aria-label="Qty"
            autoFocus
          />
          <Input
            value={newItem.nama_barang}
            onChange={(e) => onNamaChange(e.target.value)}
            className="h-8 text-sm flex-1 min-w-[160px]"
            placeholder="Nama barang baru..."
          />
          <Button size="sm" onClick={onSave} disabled={isSaving || !newItem.nama_barang.trim()}>
            <Check className="size-3.5 mr-1" />Tambah
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} aria-label="Batal tambah barang">
            <X className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
