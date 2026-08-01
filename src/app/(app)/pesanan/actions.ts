'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import { buildInvoiceData, type InvoiceData, type InvoiceSource } from '@/lib/invoice-data'
import {
  requireActivePesanan,
  requireActivePesananByItem,
  isGuardError,
  getRole,
} from '@/lib/pesanan-guards'
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
  const role = await getRole(supabase)
  if (role !== 'owner') {
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

export async function updateStatusPesanan(
  pesananId: string,
  status: StatusPesanan
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

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
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ error: string } | null> {
  if (await getRole(supabase) === 'owner') return null

  const { data: lockSetting, error: lockErr } = await supabase
    .from('settings').select('value').eq('key', 'pesanan_locked').single<{ value: string }>()
  if (lockErr || !lockSetting) return { error: 'Tidak dapat memverifikasi status kunci pesanan.' }
  if (lockSetting.value === 'true') return { error: 'Pesanan sedang dikunci oleh pemilik.' }
  return null
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
    checkHelperLock(supabase),
    requireActivePesananByItem(supabase, itemId),
  ])
  if (lockError) return lockError
  if (isGuardError(info)) return info

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
    checkHelperLock(supabase),
    requireActivePesananByItem(supabase, itemId),
  ])
  if (lockError) return lockError
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

export async function toggleItemDicekOwner(itemId: string, value: boolean): Promise<{ error?: string }> {
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

export async function resetChecklist(pesananId: string, target: 'helper' | 'owner'): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (target === 'owner') {
    const ownerError = await requireOwner(supabase)
    if (ownerError) return ownerError
  } else {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return { error: 'Tidak terautentikasi.' }
    const lockError = await checkHelperLock(supabase)
    if (lockError) return lockError
  }

  const active = await requireActivePesanan(supabase, pesananId)
  if (isGuardError(active)) return active

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

  const lockError = await checkHelperLock(supabase)
  if (lockError) return lockError

  const active = await requireActivePesanan(supabase, pesananId)
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
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const lockError = await checkHelperLock(supabase)
  if (lockError) return lockError

  const existingItem = await requireActivePesananByItem(supabase, itemId)
  if (isGuardError(existingItem)) return existingItem

  const { error } = await supabase
    .from('item_pesanan')
    .update({ nama_barang: changes.nama_barang, qty: changes.qty })
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath(`/pesanan/${existingItem.pesanan_id}`)
  return {}
}

export async function deleteItemFromPesanan(itemId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const lockError = await checkHelperLock(supabase)
  if (lockError) return lockError

  const existingItem = await requireActivePesananByItem(supabase, itemId)
  if (isGuardError(existingItem)) return existingItem

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

export async function updatePengiriman(
  pesananId: string,
  value: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // Store null instead of an empty string so the signature line stays blank.
  const trimmed = value?.trim()
  const { error } = await supabase
    .from('pesanan')
    .update({ pengiriman: trimmed || null })
    .eq('id', pesananId)

  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  revalidatePath('/pesanan')
  return {}
}

/**
 * Package count handed to the courier, printed as "( N colly )" next to the
 * pengiriman name on the signature line. Owner-only, like updatePengiriman.
 */
export async function updateColly(
  pesananId: string,
  value: number | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // Anything that isn't a positive whole number is stored as null (blank), so
  // the printed line falls back to the pengiriman name on its own. The DB check
  // constraint enforces the same rule.
  const colly =
    value !== null && Number.isInteger(value) && value > 0 ? value : null

  const { error } = await supabase
    .from('pesanan')
    .update({ colly })
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
        'kode_pesanan, created_at, tanggal_pengiriman, pengiriman, colly, nama_pelanggan, catatan, pelanggan(nama, alamat), items:item_pesanan(nama_barang, qty, harga_satuan, subtotal), pembayaran(jumlah)'
      )
      .eq('id', pesananId)
      .single<InvoiceSource>(),
  ])

  if (ownerError) return ownerError
  if (error) return { error: error.message }
  if (!pesanan) return { error: 'Pesanan tidak ditemukan.' }

  return { data: buildInvoiceData(pesanan) }
}

// Per-item price save, fired on blur when the owner edits harga satuan inline in
// the item list. Owner-only; re-derives the real pesanan_id from the item ID
// rather than trusting the client-supplied one, and verifies the pesanan is
// still active (owner bypasses the DB write-guard trigger). subtotal is a
// generated column, so updating harga_satuan recomputes it automatically.
export async function updateItemHarga(
  itemId: string,
  harga_satuan: number
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const existingItem = await requireActivePesananByItem(supabase, itemId)
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
