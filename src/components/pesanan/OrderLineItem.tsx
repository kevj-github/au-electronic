'use client'

import { memo } from 'react'
import { X } from 'lucide-react'
import { formatRupiah, parseIntOrZero } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface LineItem {
  id: string   // client-only uuid for React key
  nama_barang: string
  qty: string
  harga_satuan: string
}

interface OrderLineItemProps {
  item: LineItem
  isOwner: boolean
  onChange: (id: string, changes: Partial<LineItem>) => void
  onRemove: (id: string) => void
  autoFocus?: boolean
}

function OrderLineItemImpl({ item, isOwner, onChange, onRemove, autoFocus }: OrderLineItemProps) {
  const subtotal = parseIntOrZero(item.qty) * parseIntOrZero(item.harga_satuan)

  return (
    <tr className="border-b">
      <td className="px-3 py-2 w-24">
        <Input
          type="number"
          min="1"
          value={item.qty}
          onChange={(e) => onChange(item.id, { qty: e.target.value })}
          placeholder="Qty"
          aria-label={`Qty ${item.nama_barang}`}
          className="h-8 text-right"
          autoFocus={autoFocus}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={item.nama_barang}
          onChange={(e) => onChange(item.id, { nama_barang: e.target.value })}
          placeholder="Nama barang..."
          aria-label="Nama barang"
          className="h-8"
        />
      </td>
      <td className="px-3 py-2 w-36">
        <Input
          type="number"
          min="0"
          value={item.harga_satuan}
          onChange={(e) => onChange(item.id, { harga_satuan: e.target.value })}
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
          className="text-destructive hover:text-destructive/80 h-8 w-8 p-0"
          onClick={() => onRemove(item.id)}
          aria-label={`Hapus ${item.nama_barang}`}
        >
          <X className="size-4" />
        </Button>
      </td>
    </tr>
  )
}

export const OrderLineItem = memo(OrderLineItemImpl)

function OrderLineItemCardImpl({ item, isOwner, onChange, onRemove, autoFocus }: OrderLineItemProps) {
  const subtotal = parseIntOrZero(item.qty) * parseIntOrZero(item.harga_satuan)

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          min="1"
          value={item.qty}
          onChange={(e) => onChange(item.id, { qty: e.target.value })}
          placeholder="Qty"
          className="h-8 w-20 text-sm text-right shrink-0"
          aria-label={`Qty ${item.nama_barang}`}
          autoFocus={autoFocus}
        />
        <Input
          value={item.nama_barang}
          onChange={(e) => onChange(item.id, { nama_barang: e.target.value })}
          placeholder="Nama barang..."
          aria-label="Nama barang"
          className="h-8 text-sm flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-destructive hover:text-destructive/80 shrink-0"
          onClick={() => onRemove(item.id)}
          aria-label={`Hapus ${item.nama_barang}`}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex gap-2 items-start">
        <div className="space-y-0.5 flex-1">
          <p className="text-xs text-muted-foreground">Harga Satuan</p>
          {isOwner ? (
            <Input
              type="number"
              min="0"
              value={item.harga_satuan}
              onChange={(e) => onChange(item.id, { harga_satuan: e.target.value })}
              className="h-8 text-sm text-right font-mono w-full"
              aria-label={`Harga satuan ${item.nama_barang}`}
            />
          ) : (
            <p className="text-xs text-muted-foreground pt-2">Diisi oleh pemilik nanti</p>
          )}
        </div>
      </div>
      <p className="text-xs text-right text-muted-foreground">
        Subtotal:{' '}
        <span className="font-mono font-medium text-foreground">{formatRupiah(subtotal)}</span>
      </p>
    </div>
  )
}

export const OrderLineItemCard = memo(OrderLineItemCardImpl)
