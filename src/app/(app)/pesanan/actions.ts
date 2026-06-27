'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import type { StatusPesanan } from '@/lib/types'

export interface CreatePesananInput {
  pelanggan_id: string | null
  nama_pelanggan: string | null
  catatan: string | null
  items: Array<{
    nama_barang: string
    qty: number
    harga_satuan: number
    diskon: number
    catatan_item: string | null
  }>
}

export async function createPesanan(input: CreatePesananInput) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  if (!input.pelanggan_id && !input.nama_pelanggan) {
    return { error: 'Pilih pelanggan atau masukkan nama pelanggan.' }
  }
  if (input.items.length === 0) {
    return { error: 'Tambahkan minimal satu barang.' }
  }

  const { data: kodeData, error: kodeError } = await supabase.rpc('next_kode_pesanan')
  if (kodeError) return { error: kodeError.message }

  // Check if helpers are locked from creating new pesanan.
  // Fail-closed: any DB error reading the lock setting blocks the action rather
  // than silently allowing it through (a missing row means the table wasn't seeded,
  // which is an infrastructure problem that should surface, not be swallowed).
  const { data: userRow } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<{ role: string }>()
  if (userRow?.role !== 'owner') {
    const { data: lockSetting, error: lockErr } = await supabase
      .from('settings').select('value').eq('key', 'pesanan_locked').single<{ value: string }>()
    if (lockErr || !lockSetting) {
      return { error: 'Tidak dapat memverifikasi status kunci pesanan.' }
    }
    if (lockSetting.value === 'true') {
      return { error: 'Pembuatan pesanan baru sedang dikunci oleh pemilik.' }
    }
  }

  const { data: pesanan, error: pesananError } = await supabase
    .from('pesanan')
    .insert({
      kode_pesanan: kodeData as string,
      pelanggan_id: input.pelanggan_id,
      nama_pelanggan: input.nama_pelanggan,
      catatan: input.catatan,
      dibuat_oleh: authUser.id,
      status: 'diproses',
    })
    .select('id')
    .single<{ id: string }>()

  if (pesananError) return { error: pesananError.message }

  // Non-owners get harga_satuan/diskon forced to 0 by the guard_item_pesanan_write
  // trigger regardless of what's sent here — the owner fills in the real price later.
  const { error: itemsError } = await supabase
    .from('item_pesanan')
    .insert(
      input.items.map((item) => ({
        pesanan_id: pesanan.id,
        nama_barang: item.nama_barang,
        qty: item.qty,
        harga_satuan: item.harga_satuan,
        diskon: item.diskon,
        catatan_item: item.catatan_item,
      }))
    )

  if (itemsError) return { error: itemsError.message }

  revalidatePath('/pesanan')
  return { pesananId: pesanan.id }
}

export async function updateStatusPesanan(pesananId: string, status: StatusPesanan) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<{ role: string }>()
  if (user?.role !== 'owner') return { error: 'Hanya pemilik yang bisa mengubah status.' }

  const { error } = await supabase
    .from('pesanan')
    .update({ status })
    .eq('id', pesananId)

  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  revalidatePath('/pesanan')
  return {}
}

// Returns an error if the pesanan_locked setting is on and the user is not an owner.
async function checkHelperLock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ error: string } | null> {
  const { data: userRow } = await supabase
    .from('users').select('role').eq('id', userId).single<{ role: string }>()
  if (userRow?.role === 'owner') return null

  const { data: lockSetting, error: lockErr } = await supabase
    .from('settings').select('value').eq('key', 'pesanan_locked').single<{ value: string }>()
  if (lockErr || !lockSetting) return { error: 'Tidak dapat memverifikasi status kunci pesanan.' }
  if (lockSetting.value === 'true') return { error: 'Pesanan sedang dikunci oleh pemilik.' }
  return null
}

// Looks up an item's parent pesanan_id and status in one round-trip.
// Returns null when the item doesn't exist or the pesanan isn't accessible.
async function getItemPesananStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string
): Promise<{ pesanan_id: string; status: string } | null> {
  const { data: item } = await supabase
    .from('item_pesanan')
    .select('pesanan_id')
    .eq('id', itemId)
    .single<{ pesanan_id: string }>()
  if (!item) return null

  const { data: pesanan } = await supabase
    .from('pesanan')
    .select('status')
    .eq('id', item.pesanan_id)
    .single<{ status: string }>()
  if (!pesanan) return null

  return { pesanan_id: item.pesanan_id, status: pesanan.status }
}

// Any authenticated user can tick diambil_oleh_helper — any helper may be the one
// fetching items from the etalase. guard_item_pesanan_write is the DB-level gatekeeper;
// the status check here closes the owner bypass gap at the app layer.
export async function toggleItemDiambil(itemId: string, value: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const lockError = await checkHelperLock(supabase, authUser.id)
  if (lockError) return lockError

  const info = await getItemPesananStatus(supabase, itemId)
  if (!info || info.status !== 'diproses') return { error: 'Pesanan tidak dapat diubah.' }

  const { error } = await supabase
    .from('item_pesanan')
    .update({ diambil_oleh_helper: value })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${info.pesanan_id}`)
  return {}
}

export async function toggleItemDicekOwner(itemId: string, value: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const info = await getItemPesananStatus(supabase, itemId)
  if (!info || info.status !== 'diproses') return { error: 'Pesanan tidak dapat diubah.' }

  const { error } = await supabase
    .from('item_pesanan')
    .update({ dicek_oleh_owner: value })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${info.pesanan_id}`)
  return {}
}

export async function resetChecklist(pesananId: string, target: 'helper' | 'owner'): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (target === 'owner') {
    const ownerError = await requireOwner(supabase)
    if (ownerError) return ownerError
  } else {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return { error: 'Tidak terautentikasi.' }
    const lockError = await checkHelperLock(supabase, authUser.id)
    if (lockError) return lockError
  }

  // App-layer status check — owner bypasses the DB trigger.
  const { data: pesanan } = await supabase
    .from('pesanan').select('status').eq('id', pesananId).single<{ status: string }>()
  if (!pesanan || pesanan.status !== 'diproses') return { error: 'Pesanan tidak dapat diubah.' }

  const column = target === 'owner' ? 'dicek_oleh_owner' : 'diambil_oleh_helper'
  const { error } = await supabase
    .from('item_pesanan')
    .update({ [column]: false })
    .eq('pesanan_id', pesananId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}

export interface AddItemInput {
  nama_barang: string
  qty: number
  catatan_item: string | null
}

export async function addItemToPesanan(pesananId: string, item: AddItemInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const lockError = await checkHelperLock(supabase, authUser.id)
  if (lockError) return lockError

  // App-layer status guard: the DB trigger enforces this for non-owners, but the owner
  // bypasses the trigger. Checking here closes that gap for all callers.
  const { data: pesanan } = await supabase
    .from('pesanan').select('status').eq('id', pesananId).single<{ status: string }>()
  if (!pesanan || pesanan.status !== 'diproses') {
    return { error: 'Pesanan tidak dapat diubah.' }
  }

  const { error } = await supabase
    .from('item_pesanan')
    .insert({
      pesanan_id: pesananId,
      nama_barang: item.nama_barang,
      qty: item.qty,
      harga_satuan: 0,
      diskon: 0,
      catatan_item: item.catatan_item,
    })

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}

export async function updateItemDetails(
  itemId: string,
  pesananId: string,
  changes: { nama_barang: string; qty: number; catatan_item: string | null }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const lockError = await checkHelperLock(supabase, authUser.id)
  if (lockError) return lockError

  // Look up the item's actual pesanan_id from the DB rather than trusting the
  // client-supplied pesananId, then verify the parent pesanan is still active.
  const { data: existingItem } = await supabase
    .from('item_pesanan').select('pesanan_id').eq('id', itemId).single<{ pesanan_id: string }>()
  if (!existingItem) return { error: 'Item tidak ditemukan.' }

  const { data: pesanan } = await supabase
    .from('pesanan').select('status').eq('id', existingItem.pesanan_id).single<{ status: string }>()
  if (!pesanan || pesanan.status !== 'diproses') {
    return { error: 'Pesanan tidak dapat diubah.' }
  }

  const { error } = await supabase
    .from('item_pesanan')
    .update({ nama_barang: changes.nama_barang, qty: changes.qty, catatan_item: changes.catatan_item })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${existingItem.pesanan_id}`)
  return {}
}

export async function deleteItemFromPesanan(itemId: string, pesananId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const lockError = await checkHelperLock(supabase, authUser.id)
  if (lockError) return lockError

  // Look up the item's actual pesanan_id from the DB; don't trust client-supplied value.
  const { data: existingItem } = await supabase
    .from('item_pesanan').select('pesanan_id').eq('id', itemId).single<{ pesanan_id: string }>()
  if (!existingItem) return { error: 'Item tidak ditemukan.' }

  const { data: pesanan } = await supabase
    .from('pesanan').select('status').eq('id', existingItem.pesanan_id).single<{ status: string }>()
  if (!pesanan || pesanan.status !== 'diproses') {
    return { error: 'Pesanan tidak dapat diubah.' }
  }

  const { error } = await supabase
    .from('item_pesanan')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${existingItem.pesanan_id}`)
  return {}
}

export async function deletePesanan(pesananId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // item_pesanan and pembayaran cascade via FK ON DELETE CASCADE
  const { error } = await supabase.from('pesanan').delete().eq('id', pesananId)
  if (error) return { error: error.message }

  revalidatePath('/pesanan')
  return {}
}

export async function updateAllItemHarga(
  pesananId: string,
  items: Array<{ id: string; harga_satuan: number; diskon: number }>
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // Verify the pesanan is still active even for owner (owner bypasses the DB trigger).
  const { data: pesanan } = await supabase
    .from('pesanan').select('status').eq('id', pesananId).single<{ status: string }>()
  if (!pesanan || pesanan.status !== 'diproses') {
    return { error: 'Pesanan tidak dapat diubah.' }
  }

  for (const item of items) {
    const { error } = await supabase
      .from('item_pesanan')
      .update({ harga_satuan: item.harga_satuan, diskon: item.diskon })
      .eq('id', item.id)
    if (error) return { error: error.message }
  }

  revalidatePath(`/pesanan/${pesananId}`)
  revalidatePath('/pesanan')
  return {}
}
