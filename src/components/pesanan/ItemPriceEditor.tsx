'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { updateItemHarga } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatRupiah } from '@/lib/utils'

interface ItemPriceEditorProps {
  itemId: string
  pesananId: string
  hargaSatuan: number
  diskon: number
}

export function ItemPriceEditor({ itemId, pesananId, hargaSatuan, diskon }: ItemPriceEditorProps) {
  const [editing, setEditing] = useState(false)
  const [harga, setHarga] = useState(hargaSatuan)
  const [disc, setDisc] = useState(diskon)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)
    const result = await updateItemHarga({ itemId, pesananId, harga_satuan: harga, diskon: disc })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setLoading(false)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 font-mono text-sm hover:text-primary"
      >
        {formatRupiah(hargaSatuan)}
        <Pencil className="size-3.5 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="inline-flex w-full max-w-56 flex-col gap-2 rounded-md border bg-muted/40 p-2.5 text-left">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Harga satuan</label>
        <Input
          type="number"
          min="0"
          value={harga}
          onChange={(e) => setHarga(Number(e.target.value))}
          aria-label="Harga satuan"
          className="h-9 w-full text-right font-mono text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Diskon</label>
        <Input
          type="number"
          min="0"
          value={disc}
          onChange={(e) => setDisc(Number(e.target.value))}
          aria-label="Diskon"
          className="h-9 w-full text-right font-mono text-sm"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={loading}
        >
          <X className="size-4" />
          Batal
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
          <Check className="size-4" />
          Simpan
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
