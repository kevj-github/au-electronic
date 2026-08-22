'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import { buildInvoiceData, type InvoiceData, type InvoiceSource } from '@/lib/invoice-data'
import { itemsEmbed, pembayaranEmbed } from '@/lib/pesanan-select'
import {
  requireActivePesanan,
  requireActivePesananByItem,
  requireHelperCanMutateItem,
  requireHelperCanMutatePesanan,
  requireUnlocked,
  isGuardError,
  getRole,
  CREATE_PESANAN_LOCKED,
} from '@/lib/pesanan-guards'
import type { StatusPesanan } from '@/lib/types'
import type { Database } from '@/lib/database.types'

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

// Declared rather than inferred: TypeScript only synthesises the implicit
// `pesananId?: undefined` / `error?: undefined` members when every return is a
// fresh object literal, so returning a guard's result would otherwise narrow the
// union and break `result.error` at the call site.
export async function createPesanan(
  input: CreatePesananInput
): Promise<{ error?: string; pesananId?: string }> {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  if (!input.pelanggan_id && !input.nama_pelanggan) {
    return { error: 'Pilih pelanggan atau masukkan nama pelanggan.' }
  }
  if (input.items.length === 0) {
    return { error: 'Tambahkan minimal satu barang.' }
  }

  // Validate every line BEFORE the kode is drawn and the pesanan row inserted.
  // `item_pesanan` carries `check (qty > 0)`, and the items are inserted after
  // the parent, so an invalid line used to commit a pesanan row, burn a kode,
  // then fail the items insert — leaving an orphaned order with no items and
  // surfacing a raw Postgres constraint message. Rejecting up front means
  // nothing is written at all.
  if (input.items.some((item) => !item.nama_barang.trim())) {
    return { error: 'Nama barang tidak boleh kosong.' }
  }
  if (
    input.items.some(
      (item) => !Number.isInteger(item.qty) || item.qty < 1
    )
  ) {
    return { error: 'Qty setiap barang harus berupa angka bulat minimal 1.' }
  }

  // Helpers can be locked out of creating new pesanan; owners never are. Kept
  // in the app as well as in the RPC so the rejection is one round-trip and
  // carries this exact message.
  const role = await getRole(supabase)
  const lockError = await requireUnlocked(supabase, role, CREATE_PESANAN_LOCKED)
  if (lockError) return lockError

  // One RPC, one transaction: the kode draw, the pesanan row and every line
  // either all commit or all roll back. This replaced a three-step sequence
  // (next_kode_pesanan -> insert pesanan -> insert item_pesanan) in which each
  // step was its own transaction, so any failure on the lines left an order with
  // no items holding a permanently consumed kode. See
  // supabase/migrations/20260805081656_atomic_create_pesanan.sql, which records
  // the live verification of the rollback behaviour.
  //
  // The cast is the one place the generated types are knowably wrong: Postgres
  // function parameters carry no nullability information, so
  // `generate_typescript_types` declares all five as non-nullable `string`.
  // Four of them genuinely accept NULL — an order with no linked pelanggan, no
  // catatan, no delivery date — and the function's own validation decides what
  // is acceptable. Widening here rather than editing database.types.ts, which
  // is regenerated after every migration.
  const { data: pesananId, error } = await supabase.rpc('create_pesanan_atomic', {
    p_pelanggan_id: input.pelanggan_id,
    p_nama_pelanggan: input.nama_pelanggan,
    p_catatan: input.catatan,
    p_tanggal_pengiriman: input.tanggal_pengiriman ?? null,
    p_items: input.items,
  } as unknown as Database['public']['Functions']['create_pesanan_atomic']['Args'])

  if (error) return { error: error.message }

  revalidatePath('/pesanan')
  return { pesananId: pesananId as string }
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
export async function setItemJumlahDiambil(itemId: string, jumlah: number): Promise<{ error?: string }> {
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

export async function addItemToPesanan(pesananId: string, item: AddItemInput): Promise<{ error?: string }> {
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
): Promise<{ error?: string }> {
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

export async function deleteItemFromPesanan(itemId: string): Promise<{ error?: string }> {
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

// Owner-only, but the `guard_pesanan_write` trigger lets owners bypass the
// status check entirely — so this app-layer check is the only thing stopping
// an owner from editing shipping fields on a selesai/dibatalkan order. Same
// gap class as toggleItemDicekOwner/updateItemHarga; owner check and status
// lookup are independent, so they run concurrently.
export async function updateTanggalPengiriman(
  pesananId: string,
  value: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const [ownerError, active] = await Promise.all([
    requireOwner(supabase),
    requireActivePesanan(supabase, pesananId),
  ])
  if (ownerError) return ownerError
  if (isGuardError(active)) return active

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
  const [ownerError, active] = await Promise.all([
    requireOwner(supabase),
    requireActivePesanan(supabase, pesananId),
  ])
  if (ownerError) return ownerError
  if (isGuardError(active)) return active

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
  const [ownerError, active] = await Promise.all([
    requireOwner(supabase),
    requireActivePesanan(supabase, pesananId),
  ])
  if (ownerError) return ownerError
  if (isGuardError(active)) return active

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
        // Priced columns come from the owner-gated views so this survives the
        // phase 3 column revoke; requireOwner above is the app-layer gate.
        `kode_pesanan, created_at, tanggal_pengiriman, pengiriman, colly, nama_pelanggan, catatan, pelanggan(nama, alamat), ${itemsEmbed(true, 'nama_barang, qty, harga_satuan, subtotal')}, ${pembayaranEmbed('jumlah')}`
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
