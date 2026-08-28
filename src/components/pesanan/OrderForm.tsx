'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createPesanan } from '@/app/(app)/pesanan/actions'
import { OrderLineItem, OrderLineItemCard, type LineItem } from './OrderLineItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatRupiah, parseIntOrZero } from '@/lib/utils'
import { setErrorFromResult } from '@/lib/action-result'
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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const isDirty =
    items.length > 0 ||
    namaPelanggan.trim() !== '' ||
    pelangganId !== '' ||
    catatan.trim() !== '' ||
    tanggalPengiriman !== ''

  // Warns on tab close / refresh / typed-URL navigation. Client-side
  // navigations (router.push/back, clicking a Link) don't fire `beforeunload`
  // at all — those are handled separately by the Batal confirmation below.
  useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  function handleBatal() {
    if (isDirty) {
      setShowLeaveConfirm(true)
      return
    }
    router.back()
  }

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
  const hasEmptyName = items.some((i) => i.nama_barang.trim() === '')
  const hasInvalidQty = items.some((i) => parseIntOrZero(i.qty) < 1)
  const canSubmit = items.length > 0 && !hasEmptyName && !hasInvalidQty

  // Surfaced next to the Simpan button so a disabled state isn't a dead end —
  // see canSubmit's rationale above for why qty is checked client-side too.
  const disabledReason =
    items.length === 0
      ? 'Tambahkan minimal satu barang sebelum menyimpan.'
      : hasEmptyName && hasInvalidQty
        ? 'Isi nama dan jumlah (qty) untuk setiap barang.'
        : hasEmptyName
          ? 'Isi nama barang untuk setiap baris.'
          : hasInvalidQty
            ? 'Isi jumlah (qty) minimal 1 untuk setiap baris.'
            : null
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

    if (setErrorFromResult(result, setError)) { setLoading(false); return }

    router.push(`/pesanan/${result.pesananId}`)
  }

  return (
    <>
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
                {items.map((item) => (
                  <OrderLineItemCard
                    key={item.id}
                    item={item}
                    isOwner={isOwner}
                    onChange={updateItem}
                    onRemove={removeItem}
                    autoFocus={item.id === lastAddedId}
                  />
                ))}
                <div className="text-right text-sm font-medium pr-1">
                  Total:{' '}
                  <span className="font-mono font-semibold">{formatRupiah(grandTotal)}</span>
                </div>
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border rounded-lg overflow-hidden min-w-[560px]">
                  <thead className="bg-muted border-b">
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
                  <tfoot className="bg-muted border-t">
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
            <EmptyState message='Belum ada barang. Klik "Tambah Barang" untuk menambahkan.' />
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={loading || !canSubmit}
            >
              {loading ? 'Menyimpan...' : 'Simpan Pesanan'}
            </Button>
            <Button type="button" variant="outline" onClick={handleBatal}>
              Batal
            </Button>
          </div>
          {!loading && isDirty && disabledReason && (
            <p className="text-sm text-muted-foreground">{disabledReason}</p>
          )}
        </div>
      </form>

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan pesanan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Data yang sudah diisi akan hilang dan tidak dapat dipulihkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tetap di Sini</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => router.back()}>
              Ya, Batalkan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
