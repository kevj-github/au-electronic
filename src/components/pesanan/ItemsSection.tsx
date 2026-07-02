'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  addItemToPesanan,
  updateItemDetails,
  deleteItemFromPesanan,
} from '@/app/(app)/pesanan/actions'
import { ItemChecklistCheckbox } from './ItemChecklistCheckbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SectionItem {
  id: string
  nama_barang: string
  qty: number
  diambil_oleh_helper: boolean
  dicek_oleh_owner?: boolean
}

interface ItemsSectionProps {
  pesananId: string
  items: SectionItem[]
  isOwner: boolean
  isLocked: boolean
}

interface EditState {
  nama_barang: string
  qty: string
}

const emptyAdd: EditState = { nama_barang: '', qty: '' }

export function ItemsSection({ pesananId, items, isOwner, isLocked }: ItemsSectionProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>(emptyAdd)
  const [addingNew, setAddingNew] = useState(false)
  const [newItem, setNewItem] = useState<EditState>(emptyAdd)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function startEdit(item: SectionItem) {
    setEditingId(item.id)
    setEditState({
      nama_barang: item.nama_barang,
      qty: String(item.qty),
    })
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
    const result = await updateItemDetails(itemId, pesananId, {
      nama_barang: editState.nama_barang,
      qty,
    })
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

  async function saveNewItem() {
    if (!newItem.nama_barang.trim()) return
    const qty = parseInt(newItem.qty, 10)
    if (!qty || qty < 1) return
    setLoadingId('new')
    setError(null)
    const result = await addItemToPesanan(pesananId, {
      nama_barang: newItem.nama_barang,
      qty,
    })
    setLoadingId(null)
    if (result?.error) { setError(result.error); return }
    setAddingNew(false)
    setNewItem(emptyAdd)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-3 space-y-2">
            {editingId === item.id ? (
              <div className="space-y-2">
                <div className="flex gap-2">
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
                    placeholder="Nama barang"
                    className="h-8 text-sm flex-1"
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
              <div className="flex justify-between items-start gap-2">
                <p className="font-medium text-sm">{item.qty}× {item.nama_barang}</p>
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
            )}
            {editingId !== item.id && (
              <div className="flex flex-col gap-1 border-t pt-2">
                <ItemChecklistCheckbox
                  itemId={item.id}
                  checked={item.diambil_oleh_helper}
                  kind="helper"
                  label="Diambil dari etalase"
                  disabled={isLocked}
                />
                {isOwner && (
                  <ItemChecklistCheckbox
                    itemId={item.id}
                    checked={item.dicek_oleh_owner ?? false}
                    kind="owner"
                    label="Dicek pemilik"
                    disabled={isLocked}
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add item form — mobile */}
        {!isLocked && (
          addingNew ? (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
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
                  placeholder="Nama barang"
                  className="h-8 text-sm flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveNewItem} disabled={loadingId === 'new' || !newItem.nama_barang.trim()}>
                  <Check className="size-3.5 mr-1" />Tambah
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewItem(emptyAdd) }}>
                  <X className="size-3.5 mr-1" />Batal
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAddingNew(true)}
            >
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
              <th className="text-right px-4 py-2 font-medium w-16">Qty</th>
              <th className="text-left px-4 py-2 font-medium">Nama Barang</th>
              {!isLocked && <th className="px-4 py-2 font-medium w-16"></th>}
              <th className="text-left px-4 py-2 font-medium">Diambil</th>
              {isOwner && <th className="text-left px-4 py-2 font-medium">Dicek Pemilik</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                {editingId === item.id ? (
                  <>
                    <td className="px-4 py-2" colSpan={isOwner ? 5 : 4}>
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
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 text-right align-top">{item.qty}</td>
                    <td className="px-4 py-2 align-top">{item.nama_barang}</td>
                    {!isLocked && (
                      <td className="px-4 py-2 align-top">
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
                    <td className="px-4 py-2 align-top">
                      <ItemChecklistCheckbox
                        itemId={item.id}
                        checked={item.diambil_oleh_helper}
                        kind="helper"
                        label="Diambil"
                        disabled={isLocked}
                      />
                    </td>
                    {isOwner && (
                      <td className="px-4 py-2 align-top">
                        <ItemChecklistCheckbox
                          itemId={item.id}
                          checked={item.dicek_oleh_owner ?? false}
                          kind="owner"
                          label="Dicek"
                          disabled={isLocked}
                        />
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
                  <td className="px-4 py-2" colSpan={isOwner ? 5 : 4}>
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
                      <Button size="sm" onClick={saveNewItem} disabled={loadingId === 'new' || !newItem.nama_barang.trim()}>
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
                  <td colSpan={isOwner ? 5 : 4} className="px-4 py-2">
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
        </table>
      </div>
    </div>
  )
}
