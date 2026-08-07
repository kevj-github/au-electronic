'use client'

import { useRef, useState } from 'react'
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  addItemToPesanan,
  updateItemDetails,
  deleteItemFromPesanan,
  updateItemHarga,
} from '@/app/(app)/pesanan/actions'
import { ItemChecklistCheckbox } from './ItemChecklistCheckbox'
import { HelperItemChecklist } from './HelperItemChecklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatRupiah, formatThousandsInput, parseThousandsInput } from '@/lib/utils'

interface SectionItem {
  id: string
  nama_barang: string
  qty: number
  jumlah_diambil: number
  dicek_oleh_owner?: boolean
  // Price fields are only present for owners (helpers never receive them).
  harga_satuan?: number
  subtotal?: number
}

interface ItemsSectionProps {
  pesananId: string
  items: SectionItem[]
  isOwner: boolean
  isLocked: boolean
  // Owner can edit prices inline; false on locked orders (read-only display).
  priceEditable: boolean
}

interface EditState {
  nama_barang: string
  qty: string
}

const emptyAdd: EditState = { nama_barang: '', qty: '' }

export function ItemsSection({ pesananId, items, isOwner, isLocked, priceEditable }: ItemsSectionProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>(emptyAdd)
  const [addingNew, setAddingNew] = useState(false)
  const [newItem, setNewItem] = useState<EditState>(emptyAdd)

  // Raw (digits-only) harga satuan per item, keyed by id. Missing keys fall back
  // to the server value (see rawPrice) so newly added rows work without a re-init.
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items
        .filter((i) => i.harga_satuan !== undefined)
        .map((i) => [i.id, i.harga_satuan && i.harga_satuan > 0 ? String(i.harga_satuan) : ''])
    )
  )
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null)

  // Refs for mobile keyboard navigation (Enter key: qty → nama → save/add)
  const newQtyRef = useRef<HTMLInputElement>(null)
  const newNamaRef = useRef<HTMLInputElement>(null)
  const editQtyRef = useRef<HTMLInputElement>(null)
  const editNamaRef = useRef<HTMLInputElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function rawPrice(item: SectionItem): string {
    return prices[item.id] ?? (item.harga_satuan && item.harga_satuan > 0 ? String(item.harga_satuan) : '')
  }
  function numPrice(item: SectionItem): number {
    return parseInt(rawPrice(item) || '0', 10) || 0
  }
  function subtotalOf(item: SectionItem): number {
    return item.qty * numPrice(item)
  }
  const grandTotal = items.reduce((sum, i) => sum + subtotalOf(i), 0)

  function setPrice(id: string, value: string) {
    setPrices((prev) => ({ ...prev, [id]: parseThousandsInput(value) }))
    setError(null)
  }

  // Save on blur, but only when the value actually changed from the saved one —
  // avoids a redundant round-trip every time the field loses focus.
  async function savePrice(item: SectionItem) {
    const value = numPrice(item)
    if (value === (item.harga_satuan ?? 0)) return
    setSavingPriceId(item.id)
    setError(null)
    const result = await updateItemHarga(item.id, pesananId, value)
    setSavingPriceId(null)
    if (result?.error) { setError(result.error); return }
    router.refresh()
  }

  function startEdit(item: SectionItem) {
    setEditingId(item.id)
    setEditState({ nama_barang: item.nama_barang, qty: String(item.qty) })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function saveEdit(itemId: string) {
    if (!editState.nama_barang.trim()) return
    const qty = parseInt(editState.qty, 10)
    if (!qty || qty < 1) return
    setLoadingId(itemId)
    setError(null)
    const result = await updateItemDetails(itemId, pesananId, { nama_barang: editState.nama_barang, qty })
    setLoadingId(null)
    if (result?.error) { setError(result.error); return }
    setEditingId(null)
    router.refresh()
  }

  async function confirmDelete(itemId: string) {
    setLoadingId(itemId)
    setError(null)
    const result = await deleteItemFromPesanan(itemId, pesananId)
    setLoadingId(null)
    if (result?.error) { setError(result.error); return }
    setDeletingId(null)
    router.refresh()
  }

  async function saveNewItem(keepAdding = false) {
    if (!newItem.nama_barang.trim()) return
    const qty = parseInt(newItem.qty, 10)
    if (!qty || qty < 1) return
    setLoadingId('new')
    setError(null)
    const result = await addItemToPesanan(pesananId, { nama_barang: newItem.nama_barang, qty })
    setLoadingId(null)
    if (result?.error) { setError(result.error); return }
    setNewItem(emptyAdd)
    if (!keepAdding) {
      setAddingNew(false)
    } else {
      setTimeout(() => newQtyRef.current?.focus(), 0)
    }
    router.refresh()
  }

  // colSpan for edit/add rows. Owner adds 3 extra cols (checkbox + harga + subtotal);
  // base 3 = qty + nama + helper; edit column only when unlocked.
  const totalCols = (isOwner ? 3 : 0) + 3 + (!isLocked ? 1 : 0)

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-3">
            {editingId === item.id ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    ref={editQtyRef}
                    type="number"
                    min="1"
                    value={editState.qty}
                    onChange={(e) => setEditState((s) => ({ ...s, qty: e.target.value }))}
                    className="h-8 w-20 text-sm text-right"
                    aria-label="Qty"
                    enterKeyHint="next"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); editNamaRef.current?.focus() }
                    }}
                  />
                  <Input
                    ref={editNamaRef}
                    value={editState.nama_barang}
                    onChange={(e) => setEditState((s) => ({ ...s, nama_barang: e.target.value }))}
                    placeholder="Nama barang"
                    className="h-8 text-sm flex-1"
                    enterKeyHint="done"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void saveEdit(item.id) }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(item.id)} disabled={loadingId === item.id}>
                    <Check className="size-3.5 mr-1" />Simpan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="size-3.5 mr-1" />Batal
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  {/* Owner's checkbox — front, owner only */}
                  {isOwner && (
                    <div className="pt-0.5">
                      <ItemChecklistCheckbox
                        itemId={item.id}
                        checked={item.dicek_oleh_owner ?? false}
                        kind="owner"
                        label="Dicek pemilik"
                        showLabel={false}
                        disabled={isLocked}
                      />
                    </div>
                  )}

                  {/* Qty and Nama */}
                  <p className="text-sm font-medium flex-1 min-w-0 break-words pt-0.5">
                    {item.qty}× {item.nama_barang}
                  </p>

                  {/* Helper's checklist — back */}
                  <HelperItemChecklist
                    itemId={item.id}
                    qty={item.qty}
                    jumlahDiambil={item.jumlah_diambil}
                    disabled={isLocked}
                  />

                  {/* Edit / Delete */}
                  {!isLocked && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {deletingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            onClick={() => confirmDelete(item.id)}
                            disabled={loadingId === item.id}
                          >
                            Hapus
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setDeletingId(null)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          onClick={() => setDeletingId(item.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Price + subtotal — owner only */}
                {isOwner && (
                  <div className="mt-2 pt-2 border-t space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Harga Satuan</span>
                      {priceEditable ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatThousandsInput(rawPrice(item))}
                          onChange={(e) => setPrice(item.id, e.target.value)}
                          onBlur={() => savePrice(item)}
                          disabled={savingPriceId === item.id}
                          className="h-8 w-32 text-right font-mono text-sm"
                          aria-label={`Harga satuan ${item.nama_barang}`}
                        />
                      ) : (
                        <span className="font-mono text-sm">{formatRupiah(numPrice(item))}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Subtotal</span>
                      <span className="font-mono text-sm font-medium">{formatRupiah(subtotalOf(item))}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {/* Order total — owner only */}
        {isOwner && items.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 border rounded-lg bg-gray-50">
            <span className="text-sm font-medium">Total</span>
            <span className="font-mono text-sm font-semibold">{formatRupiah(grandTotal)}</span>
          </div>
        )}

        {/* Add item form — mobile */}
        {!isLocked && (
          addingNew ? (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  ref={newQtyRef}
                  type="number"
                  min="1"
                  value={newItem.qty}
                  onChange={(e) => setNewItem((s) => ({ ...s, qty: e.target.value }))}
                  placeholder="Qty"
                  className="h-8 w-20 text-sm text-right"
                  aria-label="Qty"
                  enterKeyHint="next"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); newNamaRef.current?.focus() }
                  }}
                />
                <Input
                  ref={newNamaRef}
                  value={newItem.nama_barang}
                  onChange={(e) => setNewItem((s) => ({ ...s, nama_barang: e.target.value }))}
                  placeholder="Nama barang"
                  className="h-8 text-sm flex-1"
                  enterKeyHint="go"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void saveNewItem(true) }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveNewItem()} disabled={loadingId === 'new' || !newItem.nama_barang.trim()}>
                  <Check className="size-3.5 mr-1" />Tambah
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewItem(emptyAdd) }}>
                  <X className="size-3.5 mr-1" />Batal
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingNew(true)}>
              <Plus className="size-4 mr-1.5" />
              Tambah Barang
            </Button>
          )
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {isOwner && <th className="w-10 px-3 py-2"></th>}
              <th className="text-right px-4 py-2 font-medium w-16">Qty</th>
              <th className="text-left px-4 py-2 font-medium">Nama Barang</th>
              {isOwner && <th className="text-right px-4 py-2 font-medium">Harga Satuan</th>}
              {isOwner && <th className="text-right px-4 py-2 font-medium">Subtotal</th>}
              <th className="w-28 px-3 py-2"></th>
              {!isLocked && <th className="w-16 px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                {editingId === item.id ? (
                  <td className="px-4 py-2" colSpan={totalCols}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        min="1"
                        value={editState.qty}
                        onChange={(e) => setEditState((s) => ({ ...s, qty: e.target.value }))}
                        className="h-8 w-20 text-sm text-right"
                        aria-label="Qty"
                        autoFocus
                      />
                      <Input
                        value={editState.nama_barang}
                        onChange={(e) => setEditState((s) => ({ ...s, nama_barang: e.target.value }))}
                        className="h-8 text-sm flex-1 min-w-[160px]"
                        placeholder="Nama barang"
                      />
                      <Button size="sm" onClick={() => saveEdit(item.id)} disabled={loadingId === item.id}>
                        <Check className="size-3.5 mr-1" />Simpan
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                ) : (
                  <>
                    {isOwner && (
                      <td className="px-3 py-2 text-center align-middle">
                        <ItemChecklistCheckbox
                          itemId={item.id}
                          checked={item.dicek_oleh_owner ?? false}
                          kind="owner"
                          label="Dicek pemilik"
                          showLabel={false}
                          disabled={isLocked}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2 text-right align-middle">{item.qty}</td>
                    <td className="px-4 py-2 align-middle">{item.nama_barang}</td>
                    {isOwner && (
                      <td className="px-4 py-2 text-right align-middle">
                        {priceEditable ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={formatThousandsInput(rawPrice(item))}
                            onChange={(e) => setPrice(item.id, e.target.value)}
                            onBlur={() => savePrice(item)}
                            disabled={savingPriceId === item.id}
                            className="h-8 w-36 ml-auto text-right font-mono text-sm"
                            aria-label={`Harga satuan ${item.nama_barang}`}
                          />
                        ) : (
                          <span className="font-mono">{formatRupiah(numPrice(item))}</span>
                        )}
                      </td>
                    )}
                    {isOwner && (
                      <td className="px-4 py-2 text-right align-middle font-mono">{formatRupiah(subtotalOf(item))}</td>
                    )}
                    <td className="px-3 py-2 text-center align-middle">
                      <HelperItemChecklist
                        itemId={item.id}
                        qty={item.qty}
                        jumlahDiambil={item.jumlah_diambil}
                        disabled={isLocked}
                      />
                    </td>
                    {!isLocked && (
                      <td className="px-4 py-2 align-middle">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground"
                            aria-label="Edit item"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          {deletingId === item.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 px-1.5 text-xs"
                                onClick={() => confirmDelete(item.id)}
                                disabled={loadingId === item.id}
                              >
                                Hapus?
                              </Button>
                              <button
                                type="button"
                                onClick={() => setDeletingId(null)}
                                className="p-1 rounded hover:bg-gray-100 text-muted-foreground"
                                aria-label="Batal hapus"
                              >
                                <X className="size-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingId(item.id)}
                              className="p-1 rounded hover:bg-gray-100 text-red-400 hover:text-red-600"
                              aria-label="Hapus item"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}

            {/* Add item row — desktop */}
            {!isLocked && (
              addingNew ? (
                <tr>
                  <td className="px-4 py-2" colSpan={totalCols}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="number"
                        min="1"
                        value={newItem.qty}
                        onChange={(e) => setNewItem((s) => ({ ...s, qty: e.target.value }))}
                        placeholder="Qty"
                        className="h-8 w-20 text-sm text-right"
                        aria-label="Qty"
                        autoFocus
                      />
                      <Input
                        value={newItem.nama_barang}
                        onChange={(e) => setNewItem((s) => ({ ...s, nama_barang: e.target.value }))}
                        className="h-8 text-sm flex-1 min-w-[160px]"
                        placeholder="Nama barang baru..."
                      />
                      <Button size="sm" onClick={() => saveNewItem()} disabled={loadingId === 'new' || !newItem.nama_barang.trim()}>
                        <Check className="size-3.5 mr-1" />Tambah
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewItem(emptyAdd) }}>
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={totalCols} className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setAddingNew(true)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                      Tambah barang
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
          {/* Order total — owner only */}
          {isOwner && items.length > 0 && (
            <tfoot className="border-t bg-gray-50">
              <tr>
                <td className="px-4 py-2 text-right font-medium" colSpan={4}>Total</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{formatRupiah(grandTotal)}</td>
                <td colSpan={1 + (!isLocked ? 1 : 0)}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
