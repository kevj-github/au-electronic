'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import type { ActionResult } from '@/lib/action-result'
import { buildInvoiceData, type InvoiceData, type InvoiceSource } from '@/lib/invoice-data'
import { itemsEmbed, pembayaranEmbed } from '@/lib/pesanan-select'
import {
  requireActivePesanan,
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

export async function createPesanan(
  input: CreatePesananInput
): Promise<ActionResult<{ pesananId?: string }>> {
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
): Promise<ActionResult> {
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

export async function deletePesanan(pesananId: string): Promise<ActionResult> {
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
): Promise<ActionResult> {
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
): Promise<ActionResult> {
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
): Promise<ActionResult> {
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
): Promise<ActionResult<{ data?: InvoiceData }>> {
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
