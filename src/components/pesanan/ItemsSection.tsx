'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addItemToPesanan,
  updateItemDetails,
  deleteItemFromPesanan,
  updateItemHarga,
} from '@/app/(app)/pesanan/actions'
import { ItemRowMobile } from './ItemRowMobile'
import { ItemRowDesktop } from './ItemRowDesktop'
import { AddItemFormMobile } from './AddItemFormMobile'
import { AddItemFormDesktop } from './AddItemFormDesktop'
import { formatRupiah, parseThousandsInput } from '@/lib/utils'
import {
  emptyAdd,
  numPrice,
  rawPrice,
  subtotalOf,
  type EditState,
  type SectionItem,
} from './itemsSectionShared'

interface ItemsSectionProps {
  pesananId: string
  items: SectionItem[]
  isOwner: boolean
  isLocked: boolean
  // Owner can edit prices inline; false on locked orders (read-only display).
  priceEditable: boolean
}

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

  // Resync pattern (see ItemChecklistCheckbox / HelperItemChecklist): drop the
  // local override for any item whose server-revalidated harga_satuan has
  // changed, so the field shows the new truth.
  //
  // Without this the editor was pinned to its mount-time values for good:
  // `prices` is seeded for every priced item at mount, so `rawPrice`'s
  // `prices[id] ?? server` never fell through. The detail page mounts
  // RealtimeRefresh on the pesanan row, so a price saved from another device
  // pushed a new `items` prop that the field ignored — it kept displaying the
  // stale number, the order total was computed from it, and blurring the field
  // wrote that stale number back over the other device's save.
  //
  // Only changed ids are dropped, so an edit in progress on a different row
  // survives. Adjusting state during render (rather than in an effect) is the
  // React-recommended form and converges: after the update the snapshot
  // matches, so the branch stops firing.
  const [prevServerPrices, setPrevServerPrices] = useState<Record<string, number | undefined>>(
    () => Object.fromEntries(items.map((i) => [i.id, i.harga_satuan])),
  )
  const repricedIds = items
    .filter((i) => prevServerPrices[i.id] !== i.harga_satuan)
    .map((i) => i.id)
  if (repricedIds.length > 0) {
    setPrevServerPrices(Object.fromEntries(items.map((i) => [i.id, i.harga_satuan])))
    setPrices((prev) => {
      const next = { ...prev }
      for (const id of repricedIds) delete next[id]
      return next
    })
  }

  // Refs for mobile keyboard navigation (Enter key: qty → nama → save/add)
  const newQtyRef = useRef<HTMLInputElement>(null)
  const newNamaRef = useRef<HTMLInputElement>(null)
  const editQtyRef = useRef<HTMLInputElement>(null)
  const editNamaRef = useRef<HTMLInputElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const grandTotal = items.reduce((sum, i) => sum + subtotalOf(i, prices), 0)

  function setPrice(id: string, value: string) {
    setPrices((prev) => ({ ...prev, [id]: parseThousandsInput(value) }))
    setError(null)
  }

  // Save on blur, but only when the value actually changed from the saved one —
  // avoids a redundant round-trip every time the field loses focus.
  async function savePrice(item: SectionItem) {
    const value = numPrice(item, prices)
    if (value === (item.harga_satuan ?? 0)) return
    setSavingPriceId(item.id)
    setError(null)
    const result = await updateItemHarga(item.id, value)
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
    const result = await updateItemDetails(itemId, { nama_barang: editState.nama_barang, qty })
    setLoadingId(null)
    if (result?.error) { setError(result.error); return }
    setEditingId(null)
    router.refresh()
  }

  async function confirmDelete(itemId: string) {
    setLoadingId(itemId)
    setError(null)
    const result = await deleteItemFromPesanan(itemId)
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
          <ItemRowMobile
            key={item.id}
            item={item}
            isOwner={isOwner}
            isLocked={isLocked}
            priceEditable={priceEditable}
            isEditing={editingId === item.id}
            editState={editState}
            editQtyRef={editQtyRef}
            editNamaRef={editNamaRef}
            onEditQtyChange={(value) => setEditState((s) => ({ ...s, qty: value }))}
            onEditNamaChange={(value) => setEditState((s) => ({ ...s, nama_barang: value }))}
            onSaveEdit={() => saveEdit(item.id)}
            onCancelEdit={cancelEdit}
            isDeleting={deletingId === item.id}
            onStartEdit={() => startEdit(item)}
            onStartDelete={() => setDeletingId(item.id)}
            onCancelDelete={() => setDeletingId(null)}
            onConfirmDelete={() => confirmDelete(item.id)}
            isLoading={loadingId === item.id}
            rawPriceValue={rawPrice(item, prices)}
            numPriceValue={numPrice(item, prices)}
            subtotalValue={subtotalOf(item, prices)}
            isSavingPrice={savingPriceId === item.id}
            onPriceChange={(value) => setPrice(item.id, value)}
            onPriceBlur={() => savePrice(item)}
          />
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
          <AddItemFormMobile
            addingNew={addingNew}
            newItem={newItem}
            newQtyRef={newQtyRef}
            newNamaRef={newNamaRef}
            onQtyChange={(value) => setNewItem((s) => ({ ...s, qty: value }))}
            onNamaChange={(value) => setNewItem((s) => ({ ...s, nama_barang: value }))}
            onSave={saveNewItem}
            onCancel={() => { setAddingNew(false); setNewItem(emptyAdd) }}
            onStartAdding={() => setAddingNew(true)}
            isSaving={loadingId === 'new'}
          />
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
              <ItemRowDesktop
                key={item.id}
                item={item}
                isOwner={isOwner}
                isLocked={isLocked}
                priceEditable={priceEditable}
                isEditing={editingId === item.id}
                editState={editState}
                totalCols={totalCols}
                editQtyRef={editQtyRef}
                onEditQtyChange={(value) => setEditState((s) => ({ ...s, qty: value }))}
                onEditNamaChange={(value) => setEditState((s) => ({ ...s, nama_barang: value }))}
                onSaveEdit={() => saveEdit(item.id)}
                onCancelEdit={cancelEdit}
                isDeleting={deletingId === item.id}
                onStartEdit={() => startEdit(item)}
                onStartDelete={() => setDeletingId(item.id)}
                onCancelDelete={() => setDeletingId(null)}
                onConfirmDelete={() => confirmDelete(item.id)}
                isLoading={loadingId === item.id}
                rawPriceValue={rawPrice(item, prices)}
                numPriceValue={numPrice(item, prices)}
                subtotalValue={subtotalOf(item, prices)}
                isSavingPrice={savingPriceId === item.id}
                onPriceChange={(value) => setPrice(item.id, value)}
                onPriceBlur={() => savePrice(item)}
              />
            ))}

            {/* Add item row — desktop */}
            {!isLocked && (
              <AddItemFormDesktop
                addingNew={addingNew}
                newItem={newItem}
                newQtyRef={newQtyRef}
                totalCols={totalCols}
                onQtyChange={(value) => setNewItem((s) => ({ ...s, qty: value }))}
                onNamaChange={(value) => setNewItem((s) => ({ ...s, nama_barang: value }))}
                onSave={() => saveNewItem()}
                onCancel={() => { setAddingNew(false); setNewItem(emptyAdd) }}
                onStartAdding={() => setAddingNew(true)}
                isSaving={loadingId === 'new'}
              />
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
