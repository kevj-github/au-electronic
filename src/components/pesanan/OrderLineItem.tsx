'use client'

import { X } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface LineItem {
  id: string   // client-only uuid for React key
  nama_barang: string
  qty: number
  harga_satuan: number
  diskon: number
  catatan_item: string
}

interface OrderLineItemProps {
  item: LineItem
  isOwner: boolean
  onChange: (id: string, changes: Partial<LineItem>) => void
  onRemove: (id: string) => void
}

export function OrderLineItem({ item, isOwner, onChange, onRemove }: OrderLineItemProps) {
  const subtotal = item.qty * item.harga_satuan - item.diskon

  return (
    <tr className="border-b">
      <td className="px-3 py-2">
        <Input
          value={item.nama_barang}
          onChange={(e) => onChange(item.id, { nama_barang: e.target.value })}
          placeholder="Nama barang..."
          aria-label="Nama barang"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2 w-24">
        <Input
          type="number"
          min="1"
          value={item.qty || ''}
          onChange={(e) => onChange(item.id, { qty: parseInt(e.target.value, 10) || 0 })}
          aria-label={`Qty ${item.nama_barang}`}
          className="h-8 text-right"
        />
      </td>
      <td className="px-3 py-2 w-36">
        <Input
          type="number"
          min="0"
          value={item.harga_satuan || ''}
          onChange={(e) => onChange(item.id, { harga_satuan: parseInt(e.target.value, 10) || 0 })}
          disabled={!isOwner}
          aria-label={`Harga satuan ${item.nama_barang}`}
          className="h-8 text-right font-mono"
        />
        {!isOwner && (
          <p className="text-xs text-muted-foreground mt-1">
            Diisi oleh pemilik nanti
          </p>
        )}
      </td>
      <td className="px-3 py-2 w-32 text-right font-mono text-sm">
        {formatRupiah(subtotal)}
      </td>
      <td className="px-3 py-2 w-12 text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
          onClick={() => onRemove(item.id)}
          aria-label={`Hapus ${item.nama_barang}`}
        >
          <X className="size-4" />
        </Button>
      </td>
    </tr>
  )
}
