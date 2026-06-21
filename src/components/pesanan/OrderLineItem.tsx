'use client'

import { X } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Produk } from '@/lib/types'

export interface LineItem {
  id: string   // client-only uuid for React key
  produk: Produk | null   // null when nama_custom is set (off-catalog item)
  nama_custom: string
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
  const nama = item.produk?.nama ?? item.nama_custom

  return (
    <tr className="border-b">
      <td className="px-3 py-2">
        {item.produk ? (
          <>
            <p className="font-medium text-sm">{item.produk.nama}</p>
            <p className="text-xs text-muted-foreground">{item.produk.satuan}</p>
          </>
        ) : (
          <>
            <Input
              value={item.nama_custom}
              onChange={(e) => onChange(item.id, { nama_custom: e.target.value })}
              placeholder="Nama produk..."
              aria-label="Nama produk kustom"
              className="h-8"
            />
            <p className="text-xs text-muted-foreground mt-1">Di luar katalog</p>
          </>
        )}
      </td>
      <td className="px-3 py-2 w-24">
        <Input
          type="number"
          min="1"
          value={item.qty}
          onChange={(e) => onChange(item.id, { qty: Number(e.target.value) })}
          aria-label={`Qty ${nama}`}
          className="h-8 text-right"
        />
      </td>
      <td className="px-3 py-2 w-36">
        <Input
          type="number"
          min="0"
          value={item.harga_satuan}
          onChange={(e) => onChange(item.id, { harga_satuan: Number(e.target.value) })}
          disabled={!isOwner}
          aria-label={`Harga satuan ${nama}`}
          className="h-8 text-right font-mono"
        />
        {!isOwner && (
          <p className="text-xs text-muted-foreground mt-1">
            {formatRupiah(item.harga_satuan)}
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
          aria-label={`Hapus ${nama}`}
        >
          <X className="size-4" />
        </Button>
      </td>
    </tr>
  )
}
