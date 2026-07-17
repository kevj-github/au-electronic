'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAllItemHarga } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatRupiah } from '@/lib/utils'

interface PriceRow {
  id: string
  nama_barang: string
  qty: number
  harga_satuan: number
}

interface BulkPriceFormProps {
  pesananId: string
  items: PriceRow[]
}

export function BulkPriceForm({ pesananId, items }: BulkPriceFormProps) {
  const router = useRouter()
  const [prices, setPrices] = useState<Record<string, { harga_satuan: string }>>(
    Object.fromEntries(items.map((i) => [i.id, {
      harga_satuan: i.harga_satuan > 0 ? String(i.harga_satuan) : '',
    }]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function setField(id: string, field: 'harga_satuan', value: string) {
    setPrices((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
    setSaved(false)
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    const result = await updateAllItemHarga(
      pesananId,
      items.map((i) => ({
        id: i.id,
        harga_satuan: parseInt(prices[i.id]?.harga_satuan || '0', 10) || 0,
      }))
    )
    setLoading(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setSaved(true)
    router.refresh()
  }

  const grandTotal = items.reduce((sum, i) => {
    const p = prices[i.id]
    const h = parseInt(p?.harga_satuan || '0', 10) || 0
    return sum + i.qty * h
  }, 0)

  if (items.length === 0) return null

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-medium text-sm">Harga Item</h3>
      </div>

      {/* Mobile: stacked rows */}
      <div className="sm:hidden divide-y">
        {items.map((item) => {
          const p = prices[item.id]
          const harga = parseInt(p?.harga_satuan || '0', 10) || 0
          const subtotal = item.qty * harga
          return (
            <div key={item.id} className="p-3 space-y-2">
              <p className="text-sm font-medium">{item.nama_barang} <span className="text-muted-foreground font-normal">× {item.qty}</span></p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Harga Satuan</label>
                <Input
                  type="number"
                  min="0"
                  value={p?.harga_satuan ?? ''}
                  onChange={(e) => setField(item.id, 'harga_satuan', e.target.value)}
                  className="h-8 text-right font-mono text-sm"
                />
              </div>
              <p className="text-xs text-right text-muted-foreground">
                Subtotal: <span className="font-mono font-medium text-foreground">{formatRupiah(subtotal)}</span>
              </p>
            </div>
          )
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50/50">
            <tr>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground w-16">Qty</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Barang</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Harga Satuan</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const p = prices[item.id]
              const harga = parseInt(p?.harga_satuan || '0', 10) || 0
              const subtotal = item.qty * harga
              return (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-right text-muted-foreground">{item.qty}</td>
                  <td className="px-4 py-2">{item.nama_barang}</td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min="0"
                      value={p?.harga_satuan ?? ''}
                      onChange={(e) => setField(item.id, 'harga_satuan', e.target.value)}
                      className="h-8 w-36 ml-auto text-right font-mono text-sm"
                      aria-label={`Harga satuan ${item.nama_barang}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{formatRupiah(subtotal)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t bg-gray-50">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right font-medium">Total</td>
              <td className="px-4 py-2 text-right font-mono font-semibold">{formatRupiah(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-between gap-3">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && !error && <p className="text-sm text-green-600">Harga disimpan.</p>}
        {!error && !saved && <span />}
        <Button onClick={handleSave} disabled={loading} size="sm">
          {loading ? 'Menyimpan...' : 'Simpan Semua Harga'}
        </Button>
      </div>
    </div>
  )
}
