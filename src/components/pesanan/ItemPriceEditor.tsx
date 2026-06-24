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
        className="inline-flex items-center gap-1 font-mono hover:text-primary"
      >
        {formatRupiah(hargaSatuan)}
        <Pencil className="size-3 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          value={harga}
          onChange={(e) => setHarga(Number(e.target.value))}
          aria-label="Harga satuan"
          className="h-7 w-28 text-right font-mono text-xs"
        />
        <Button type="button" size="sm" className="h-7 w-7 p-0" onClick={handleSave} disabled={loading}>
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setEditing(false)}
          disabled={loading}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <Input
        type="number"
        min="0"
        value={disc}
        onChange={(e) => setDisc(Number(e.target.value))}
        aria-label="Diskon"
        placeholder="Diskon"
        className="h-7 w-28 text-right font-mono text-xs"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
