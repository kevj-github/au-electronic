'use client'

import type { RefObject } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EditState } from './itemsSectionShared'

interface AddItemFormMobileProps {
  addingNew: boolean
  newItem: EditState
  newQtyRef: RefObject<HTMLInputElement | null>
  newNamaRef: RefObject<HTMLInputElement | null>
  onQtyChange: (value: string) => void
  onNamaChange: (value: string) => void
  onSave: (keepAdding?: boolean) => void
  onCancel: () => void
  onStartAdding: () => void
  isSaving: boolean
}

export function AddItemFormMobile({
  addingNew,
  newItem,
  newQtyRef,
  newNamaRef,
  onQtyChange,
  onNamaChange,
  onSave,
  onCancel,
  onStartAdding,
  isSaving,
}: AddItemFormMobileProps) {
  if (!addingNew) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={onStartAdding}>
        <Plus className="size-4 mr-1.5" />
        Tambah Barang
      </Button>
    )
  }

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex gap-2">
        <Input
          ref={newQtyRef}
          type="number"
          min="1"
          value={newItem.qty}
          onChange={(e) => onQtyChange(e.target.value)}
          placeholder="Qty"
          className="h-8 w-20 text-sm text-right"
          aria-label="Qty"
          enterKeyHint="next"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); newNamaRef.current?.focus() }
          }}
        />
        <Input
          ref={newNamaRef}
          value={newItem.nama_barang}
          onChange={(e) => onNamaChange(e.target.value)}
          placeholder="Nama barang"
          className="h-8 text-sm flex-1"
          enterKeyHint="go"
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onSave(true) }
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave()} disabled={isSaving || !newItem.nama_barang.trim()}>
          <Check className="size-3.5 mr-1" />Tambah
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="size-3.5 mr-1" />Batal
        </Button>
      </div>
    </div>
  )
}
