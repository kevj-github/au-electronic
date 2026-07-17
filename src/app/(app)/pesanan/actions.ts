'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import { buildInvoiceData, type InvoiceData, type InvoiceSource } from '@/lib/invoice-data'
import type { StatusPesanan } from '@/lib/types'

export interface CreatePesananInput {
  pelanggan_id: string | null
  nama_pelanggan: string | null
  catatan: string | null
  tanggal_pengiriman?: string | null
  items: Array<{
    nama_barang: string
    qty: number
    harga_satuan: number
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
      tanggal_pengiriman: input.tanggal_pengiriman ?? null,
      dibuat_oleh: authUser.id,
      status: 'diproses',
    })
    .select('id')
    .single<{ id: string }>()

  if (pesananError) return { error: pesananError.message }

  // Non-owners get harga_satuan forced to 0 by the guard_item_pesanan_write
  // trigger regardless of what's sent here — the owner fills in the real price later.
  const { error: itemsError } = await supabase
    .from('item_pesanan')
    .insert(
      input.items.map((item) => ({
        pesanan_id: pesanan.id,
        nama_barang: item.nama_barang,
        qty: item.qty,
        harga_satuan: item.harga_satuan,
        catatan_item: null,
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

// Looks up an item's parent pesanan_id, qty, and pesanan status in a single join query.
async function getItemPesananStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string
): Promise<{ pesanan_id: string; qty: number; status: string } | null> {
  const { data } = await supabase
    .from('item_pesanan')
    .select('pesanan_id, qty, pesanan:pesanan(status)')
    .eq('id', itemId)
    .single<{ pesanan_id: string; qty: number; pesanan: { status: string } | null }>()
  if (!data?.pesanan) return null
  return { pesanan_id: data.pesanan_id, qty: data.qty, status: data.pesanan.status }
}

// Any authenticated user can set jumlah_diambil — any helper may be the one
// fetching items from the etalase. guard_item_pesanan_write is the DB-level gatekeeper
// (it also clamps jumlah_diambil to qty); the status check here closes the owner
// bypass gap at the app layer. diambil_oleh_helper is a generated column derived
// from jumlah_diambil, so checking the box is just "set jumlah_diambil to qty".
export async function toggleItemDiambil(itemId: string, value: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  // Lock check and item-status lookup are independent — run them concurrently.
  const [lockError, info] = await Promise.all([
    checkHelperLock(supabase, authUser.id),
    getItemPesananStatus(supabase, itemId),
  ])
  if (lockError) return lockError
  if (!info || info.status !== 'diproses') return { error: 'Pesanan tidak dapat diubah.' }

  const { error } = await supabase
    .from('item_pesanan')
    .update({ jumlah_diambil: value ? info.qty : 0 })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${info.pesanan_id}`)
  return {}
}

// Sets the partial quantity taken from the etalase. Clamped to [0, qty] here (using
// the DB-fetched qty, never a client-supplied one) as well as by the DB trigger.
export async function setItemJumlahDiambil(itemId: string, jumlah: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const [lockError, info] = await Promise.all([
    checkHelperLock(supabase, authUser.id),
    getItemPesananStatus(supabase, itemId),
  ])
  if (lockError) return lockError
  if (!info || info.status !== 'diproses') return { error: 'Pesanan tidak dapat diubah.' }

  const clamped = Math.max(0, Math.min(Math.trunc(jumlah), info.qty))

  const { error } = await supabase
    .from('item_pesanan')
    .update({ jumlah_diambil: clamped })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${info.pesanan_id}`)
  return {}
}

export async function toggleItemDicekOwner(itemId: string, value: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Owner check and item-status lookup are independent — run them concurrently.
  const [ownerError, info] = await Promise.all([
    requireOwner(supabase),
    getItemPesananStatus(supabase, itemId),
  ])
  if (ownerError) return ownerError
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
      catatan_item: null,
    })

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}

export async function updateItemDetails(
  itemId: string,
  pesananId: string,
  changes: { nama_barang: string; qty: number }
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
    .update({ nama_barang: changes.nama_barang, qty: changes.qty })
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

export async function updateTanggalPengiriman(
  pesananId: string,
  value: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const { error } = await supabase
    .from('pesanan')
    .update({ tanggal_pengiriman: value })
    .eq('id', pesananId)

  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  revalidatePath('/pesanan')
  return {}
}

/**
 * Fetch the current invoice data straight from the DB. Called at PDF/WhatsApp
 * generation time so the document always reflects the latest saved state,
 * independent of any stale render-time props on the client. Owner-only, since
 * it returns price/payment data.
 */
export async function getInvoiceData(
  pesananId: string
): Promise<{ data?: InvoiceData; error?: string }> {
  const supabase = await createClient()

  // Run the owner check and the data fetch concurrently to shave a round-trip
  // off the print/copy path. The query runs under the caller's RLS session; if
  // they turn out not to be owner we discard the result and return the error, so
  // price data never leaves the server for a non-owner.
  const [ownerError, { data: pesanan, error }] = await Promise.all([
    requireOwner(supabase),
    supabase
      .from('pesanan')
      .select(
        'kode_pesanan, created_at, tanggal_pengiriman, nama_pelanggan, catatan, pelanggan(nama, alamat), items:item_pesanan(nama_barang, qty, harga_satuan, subtotal), pembayaran(jumlah)'
      )
      .eq('id', pesananId)
      .single<InvoiceSource>(),
  ])

  if (ownerError) return ownerError
  if (error) return { error: error.message }
  if (!pesanan) return { error: 'Pesanan tidak ditemukan.' }

  return { data: buildInvoiceData(pesanan) }
}

export async function updateAllItemHarga(
  pesananId: string,
  items: Array<{ id: string; harga_satuan: number }>
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Owner check and the active-status check are independent — run concurrently.
  // (Owner bypasses the DB trigger, so we still verify status at the app layer.)
  const [ownerError, { data: pesanan }] = await Promise.all([
    requireOwner(supabase),
    supabase
      .from('pesanan').select('status').eq('id', pesananId).single<{ status: string }>(),
  ])
  if (ownerError) return ownerError
  if (!pesanan || pesanan.status !== 'diproses') {
    return { error: 'Pesanan tidak dapat diubah.' }
  }

  const results = await Promise.all(
    items.map((item) =>
      supabase
        .from('item_pesanan')
        .update({ harga_satuan: item.harga_satuan })
        .eq('id', item.id)
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  revalidatePath('/pesanan')
  return {}
}
