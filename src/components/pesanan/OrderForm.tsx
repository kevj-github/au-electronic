'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createPesanan } from '@/app/(app)/pesanan/actions'
import { OrderLineItem, type LineItem } from './OrderLineItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRupiah, parseIntOrZero } from '@/lib/utils'
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
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [tanggalPengiriman, setTanggalPengiriman] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  function addItem() {
    const newId = crypto.randomUUID()
    setItems((prev) => [
      ...prev,
      {
        id: newId,
        nama_barang: '',
        qty: '',
        harga_satuan: '',
      },
    ])
    setLastAddedId(newId)
  }

  const updateItem = useCallback((id: string, changes: Partial<LineItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const grandTotal = items.reduce(
    (sum, i) => sum + parseIntOrZero(i.qty) * parseIntOrZero(i.harga_satuan),
    0
  )

  /**
   * Every line must have a name and a usable qty. qty is checked here as well
   * as in `createPesanan` because `item_pesanan` carries `check (qty > 0)` and
   * a newly added line starts at qty 0 — so the obvious "add a row, type a
   * name, hit Simpan" path used to fail at the database. The action is the real
   * guard; this only stops the button offering an outcome that cannot succeed.
   */
  const canSubmit =
    items.length > 0 &&
    items.every((i) => i.nama_barang.trim() !== '' && parseIntOrZero(i.qty) >= 1)
  const pelangganSuggestions = useMemo(() => {
    const q = namaPelanggan.trim().toLowerCase()
    if (!q || pelangganId) return []

    return pelangganList
      .filter((p) => p.nama.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.nama.toLowerCase().startsWith(q) ? 0 : 1
        const bStarts = b.nama.toLowerCase().startsWith(q) ? 0 : 1
        return aStarts - bStarts || a.nama.localeCompare(b.nama)
      })
      .slice(0, 8)
  }, [namaPelanggan, pelangganId, pelangganList])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const namaInput = namaPelanggan.trim()
    const matchedPelanggan = !pelangganId
      ? pelangganList.find(
          (p) => p.nama.trim().toLowerCase() === namaInput.toLowerCase()
        )
      : null
    const resolvedPelangganId = pelangganId || matchedPelanggan?.id || null

    const result = await createPesanan({
      pelanggan_id: resolvedPelangganId,
      nama_pelanggan: resolvedPelangganId ? null : namaInput || null,
      catatan: catatan || null,
      tanggal_pengiriman: isOwner ? tanggalPengiriman || null : null,
      items: items.map((i) => ({
        nama_barang: i.nama_barang,
        qty: parseIntOrZero(i.qty),
        harga_satuan: parseIntOrZero(i.harga_satuan),
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
                  {p.nama}
                  {p.alamat ? ` — ${p.alamat}` : ''} (
                  {p.tipe === 'grosir' ? 'Grosir' : 'Retail'})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Atau ketik nama langsung</Label>
            <div className="relative">
              <Input
                value={namaPelanggan}
                onChange={(e) => {
                  setNamaPelanggan(e.target.value)
                  if (e.target.value) {
                    setPelangganId('')
                    setShowSuggestions(true)
                  } else {
                    setShowSuggestions(false)
                  }
                }}
                onFocus={() => {
                  if (namaPelanggan.trim()) setShowSuggestions(true)
                }}
                onBlur={() => setShowSuggestions(false)}
                placeholder="Nama pelanggan baru..."
                disabled={!!pelangganId}
                autoComplete="off"
              />

              {showSuggestions && pelangganSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-md">
                  <ul className="max-h-56 overflow-auto py-1">
                    {pelangganSuggestions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setPelangganId(p.id)
                            setNamaPelanggan('')
                            setShowSuggestions(false)
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="block">{p.nama}</span>
                          {p.alamat && (
                            <span className="block text-xs text-muted-foreground">
                              {p.alamat}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
          <>
            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2">
              {items.map((item) => {
                const subtotal = parseIntOrZero(item.qty) * parseIntOrZero(item.harga_satuan)
                return (
                  <div key={item.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(item.id, { qty: e.target.value })}
                        placeholder="Qty"
                        className="h-8 w-20 text-sm text-right shrink-0"
                        aria-label="Qty"
                        autoFocus={item.id === lastAddedId}
                      />
                      <Input
                        value={item.nama_barang}
                        onChange={(e) => updateItem(item.id, { nama_barang: e.target.value })}
                        placeholder="Nama barang..."
                        className="h-8 text-sm flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 shrink-0"
                        onClick={() => removeItem(item.id)}
                        aria-label="Hapus barang"
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
                            onChange={(e) => updateItem(item.id, { harga_satuan: e.target.value })}
                            className="h-8 text-sm text-right font-mono w-full"
                            aria-label="Harga satuan"
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
              })}
              <div className="text-right text-sm font-medium pr-1">
                Total:{' '}
                <span className="font-mono font-semibold">{formatRupiah(grandTotal)}</span>
              </div>
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden min-w-[560px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-right px-3 py-2 font-medium w-24">Qty</th>
                    <th className="text-left px-3 py-2 font-medium">Nama Barang</th>
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
                      autoFocus={item.id === lastAddedId}
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
          </>
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

      {/* Tanggal Pengiriman — owner only */}
      {isOwner && (
        <div className="space-y-2">
          <Label htmlFor="tanggal-pengiriman">Tanggal Pengiriman (opsional)</Label>
          <Input
            id="tanggal-pengiriman"
            type="date"
            value={tanggalPengiriman}
            onChange={(e) => setTanggalPengiriman(e.target.value)}
            className="w-48"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={loading || !canSubmit}
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
