'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPesanan } from '@/app/(app)/pesanan/actions'
import { OrderLineItem, type LineItem } from './OrderLineItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRupiah } from '@/lib/utils'
import type { Pelanggan, Produk } from '@/lib/types'

interface OrderFormProps {
  pelangganList: Pelanggan[]
  produkList: Produk[]
  isOwner: boolean
}

export function OrderForm({ pelangganList, produkList, isOwner }: OrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pelangganId, setPelangganId] = useState<string>('')
  const [namaPelanggan, setNamaPelanggan] = useState('')
  const [tipeDokumen, setTipeDokumen] = useState<'invoice' | 'nota'>('nota')
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [produkSearch, setProdukSearch] = useState('')

  function addProduk(produk: Produk) {
    const existing = items.find((i) => i.produk?.id === produk.id)
    if (existing) {
      setItems((prev) =>
        prev.map((i) =>
          i.produk?.id === produk.id ? { ...i, qty: i.qty + 1 } : i
        )
      )
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          produk,
          nama_custom: '',
          qty: 1,
          harga_satuan: produk.harga_dasar,
          diskon: 0,
          catatan_item: '',
        },
      ])
    }
    setProdukSearch('')
  }

  function addProdukKustom(nama: string) {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        produk: null,
        nama_custom: nama,
        qty: 1,
        harga_satuan: 0,
        diskon: 0,
        catatan_item: '',
      },
    ])
    setProdukSearch('')
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

  const filteredProduk = produkSearch
    ? produkList
        .filter((p) => p.aktif && p.nama.toLowerCase().includes(produkSearch.toLowerCase()))
        .slice(0, 6)
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createPesanan({
      pelanggan_id: pelangganId || null,
      nama_pelanggan: !pelangganId ? namaPelanggan || null : null,
      tipe_dokumen: tipeDokumen,
      catatan: catatan || null,
      items: items.map((i) => ({
        produk_id: i.produk?.id ?? null,
        nama_custom: i.produk ? null : i.nama_custom,
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
        <div className="grid grid-cols-2 gap-4">
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

      {/* Tipe dokumen */}
      <div className="space-y-2">
        <Label>Tipe Dokumen</Label>
        <div className="flex gap-4">
          {(['nota', 'invoice'] as const).map((tipe) => (
            <label key={tipe} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="tipe_dokumen"
                value={tipe}
                checked={tipeDokumen === tipe}
                onChange={() => setTipeDokumen(tipe)}
              />
              <span className="text-sm capitalize">{tipe === 'nota' ? 'Nota (B2C)' : 'Invoice (B2B)'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Produk search + line items */}
      <div className="space-y-3">
        <h3 className="font-medium">Produk</h3>

        {/* Search */}
        <div className="relative">
          <Input
            value={produkSearch}
            onChange={(e) => setProdukSearch(e.target.value)}
            placeholder="Cari dan tambah produk..."
          />
          {produkSearch && (
            <div className="absolute top-full left-0 right-0 z-10 bg-white border rounded-md shadow-lg mt-1">
              {filteredProduk.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between text-sm"
                  onClick={() => addProduk(p)}
                >
                  <span>{p.nama}</span>
                  <span className="text-muted-foreground font-mono">
                    {formatRupiah(p.harga_dasar)} / {p.satuan}
                  </span>
                </button>
              ))}
              {filteredProduk.length === 0 && (
                isOwner ? (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-blue-600"
                    onClick={() => addProdukKustom(produkSearch)}
                  >
                    + Tambah &quot;{produkSearch}&quot; sebagai produk di luar katalog
                  </button>
                ) : (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Produk tidak ditemukan. Hubungi pemilik untuk menambahkannya ke katalog.
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {/* Line items table */}
        {items.length > 0 && (
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Produk</th>
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
          disabled={loading || items.length === 0 || items.some((i) => !i.produk && !i.nama_custom.trim())}
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
