'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import type { ActionResult } from '@/lib/action-result'
import {
  requireActivePesanan,
  requireActivePesananByItem,
  requireHelperCanMutateItem,
  requireHelperCanMutatePesanan,
  isGuardError,
} from '@/lib/pesanan-guards'

// Sets the partial quantity taken from the etalase — the only way the helper
// checklist writes `jumlah_diambil`. An all-or-nothing `toggleItemDiambil` used
// to sit alongside this; it was superseded when the checklist gained partial
// quantities and removed once nothing called it. Every export in a 'use server'
// file is a publicly reachable POST endpoint with a stable action id, so an
// uncalled one is live surface area, not dead weight — delete rather than keep.
//
// Any authenticated user may write it: any helper can be the one fetching from
// the etalase. `guard_item_pesanan_write` is the DB-level gatekeeper (it clamps
// to qty as well); the app-layer status check closes the owner-bypass gap.
// `diambil_oleh_helper` is a generated column derived from `jumlah_diambil`.
//
// Clamped to [0, qty] here using the DB-fetched qty, never a client-supplied one.
export async function setItemJumlahDiambil(itemId: string, jumlah: number): Promise<ActionResult> {
  const supabase = await createClient()

  const info = await requireHelperCanMutateItem(supabase, itemId)
  if (isGuardError(info)) return info

  const clamped = Math.max(0, Math.min(Math.trunc(jumlah), info.qty))

  const { error } = await supabase
    .from('item_pesanan')
    .update({ jumlah_diambil: clamped })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${info.pesanan_id}`)
  return {}
}

export async function toggleItemDicekOwner(itemId: string, value: boolean): Promise<ActionResult> {
  const supabase = await createClient()

  // Owner check and item-status lookup are independent — run them concurrently.
  const [ownerError, info] = await Promise.all([
    requireOwner(supabase),
    requireActivePesananByItem(supabase, itemId),
  ])
  if (ownerError) return ownerError
  if (isGuardError(info)) return info

  const { error } = await supabase
    .from('item_pesanan')
    .update({ dicek_oleh_owner: value })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${info.pesanan_id}`)
  return {}
}

export async function resetChecklist(pesananId: string, target: 'helper' | 'owner'): Promise<ActionResult> {
  const supabase = await createClient()

  if (target === 'owner') {
    // Owners skip the helper lock but still can't touch a closed order. The
    // owner check and the status lookup are independent — run concurrently.
    const [ownerError, active] = await Promise.all([
      requireOwner(supabase),
      requireActivePesanan(supabase, pesananId),
    ])
    if (ownerError) return ownerError
    if (isGuardError(active)) return active
  } else {
    const active = await requireHelperCanMutatePesanan(supabase, pesananId)
    if (isGuardError(active)) return active
  }

  // diambil_oleh_helper is a generated column derived from jumlah_diambil,
  // so resetting the helper checklist means zeroing jumlah_diambil instead.
  const update = target === 'owner' ? { dicek_oleh_owner: false } : { jumlah_diambil: 0 }
  const { error } = await supabase
    .from('item_pesanan')
    .update(update)
    .eq('pesanan_id', pesananId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}

export interface AddItemInput {
  nama_barang: string
  qty: number
}

export async function addItemToPesanan(pesananId: string, item: AddItemInput): Promise<ActionResult> {
  const supabase = await createClient()

  const active = await requireHelperCanMutatePesanan(supabase, pesananId)
  if (isGuardError(active)) return active

  const { error } = await supabase
    .from('item_pesanan')
    .insert({
      pesanan_id: pesananId,
      nama_barang: item.nama_barang,
      qty: item.qty,
      harga_satuan: 0,
      catatan_item: null,
    })

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}

export async function updateItemDetails(
  itemId: string,
  changes: { nama_barang: string; qty: number }
): Promise<ActionResult> {
  const supabase = await createClient()

  const existingItem = await requireHelperCanMutateItem(supabase, itemId)
  if (isGuardError(existingItem)) return existingItem

  const { error } = await supabase
    .from('item_pesanan')
    .update({ nama_barang: changes.nama_barang, qty: changes.qty })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${existingItem.pesanan_id}`)
  return {}
}

export async function deleteItemFromPesanan(itemId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const existingItem = await requireHelperCanMutateItem(supabase, itemId)
  if (isGuardError(existingItem)) return existingItem

  const { error } = await supabase
    .from('item_pesanan')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${existingItem.pesanan_id}`)
  return {}
}

// Per-item price save, fired on blur when the owner edits harga satuan inline in
// the item list. Owner-only; re-derives the real pesanan_id from the item ID
// rather than trusting the client-supplied one, and verifies the pesanan is
// still active (owner bypasses the DB write-guard trigger). subtotal is a
// generated column, so updating harga_satuan recomputes it automatically.
export async function updateItemHarga(
  itemId: string,
  harga_satuan: number
): Promise<ActionResult> {
  const supabase = await createClient()

  // Owner check and item-status lookup are independent — run them concurrently.
  const [ownerError, existingItem] = await Promise.all([
    requireOwner(supabase),
    requireActivePesananByItem(supabase, itemId),
  ])
  if (ownerError) return ownerError
  if (isGuardError(existingItem)) return existingItem

  const { error } = await supabase
    .from('item_pesanan')
    .update({ harga_satuan })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${existingItem.pesanan_id}`)
  revalidatePath('/pesanan')
  return {}
}
