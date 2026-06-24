'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createPesanan } from '@/app/(app)/pesanan/actions'
import { OrderLineItem, type LineItem } from './OrderLineItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRupiah } from '@/lib/utils'
import type { Pelanggan } from '@/lib/types'

interface OrderFormProps {
  pelangganList: Pelanggan[]
  isOwner: boolean
}

export function OrderForm({ pelangganList, isOwner }: OrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pelangganId, setPelangganId] = useState<string>('')
  const [namaPelanggan, setNamaPelanggan] = useState('')
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState<LineItem[]>([])

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nama_barang: '',
        qty: 1,
        harga_satuan: 0,
        diskon: 0,
        catatan_item: '',
      },
    ])
  }

  function updateItem(id: string, changes: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const grandTotal = items.reduce(
    (sum, i) => sum + i.qty * i.harga_satuan - i.diskon,
    0
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createPesanan({
      pelanggan_id: pelangganId || null,
      nama_pelanggan: !pelangganId ? namaPelanggan || null : null,
      catatan: catatan || null,
      items: items.map((i) => ({
        nama_barang: i.nama_barang,
        qty: i.qty,
        harga_satuan: i.harga_satuan,
        diskon: i.diskon,
        catatan_item: i.catatan_item || null,
      })),
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push(`/pesanan/${result.pesananId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Pelanggan */}
      <div className="space-y-3">
        <h3 className="font-medium">Pelanggan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pilih dari daftar</Label>
            <select
              value={pelangganId}
              onChange={(e) => {
                setPelangganId(e.target.value)
                if (e.target.value) setNamaPelanggan('')
              }}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Pilih pelanggan —</option>
              {pelangganList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.tipe === 'grosir' ? 'Grosir' : 'Retail'})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Atau ketik nama langsung</Label>
            <Input
              value={namaPelanggan}
              onChange={(e) => {
                setNamaPelanggan(e.target.value)
                if (e.target.value) setPelangganId('')
              }}
              placeholder="Nama pelanggan baru..."
              disabled={!!pelangganId}
            />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Barang</h3>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="size-4" />
            Tambah Barang
          </Button>
        </div>

        {items.length > 0 && (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full text-sm border rounded-lg overflow-hidden min-w-[560px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Nama Barang</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Harga Satuan</th>
                  <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <OrderLineItem
                    key={item.id}
                    item={item}
                    isOwner={isOwner}
                    onChange={updateItem}
                    onRemove={removeItem}
                  />
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right font-medium">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatRupiah(grandTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {items.length === 0 && (
          <p className="text-sm text-muted-foreground border rounded-lg p-4">
            Belum ada barang. Klik &quot;Tambah Barang&quot; untuk menambahkan.
          </p>
        )}
      </div>

      {/* Catatan */}
      <div className="space-y-2">
        <Label htmlFor="catatan">Catatan (opsional)</Label>
        <Input
          id="catatan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Catatan tambahan..."
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={loading || items.length === 0 || items.some((i) => !i.nama_barang.trim())}
        >
          {loading ? 'Menyimpan...' : 'Simpan Pesanan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  )
}
