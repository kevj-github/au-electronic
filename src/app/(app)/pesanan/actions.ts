'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import type { StatusPesanan, TipeDokumen } from '@/lib/types'

export interface LineItemInput {
  qty: number
  harga_satuan: number
  diskon: number
}

export function calcOrderTotal(items: LineItemInput[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.harga_satuan - item.diskon, 0)
}

export interface CreatePesananInput {
  pelanggan_id: string | null
  nama_pelanggan: string | null
  tipe_dokumen: TipeDokumen
  catatan: string | null
  items: Array<{
    produk_id: string
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
    return { error: 'Tambahkan minimal satu produk.' }
  }

  const { data: kodeData, error: kodeError } = await supabase
    .rpc('next_kode_pesanan', { p_tipe: input.tipe_dokumen })
  if (kodeError) return { error: kodeError.message }

  const { data: pesanan, error: pesananError } = await supabase
    .from('pesanan')
    .insert({
      kode_pesanan: kodeData as string,
      pelanggan_id: input.pelanggan_id,
      nama_pelanggan: input.nama_pelanggan,
      tipe_dokumen: input.tipe_dokumen,
      catatan: input.catatan,
      dibuat_oleh: authUser.id,
      status: 'draft',
    })
    .select('id')
    .single<{ id: string }>()

  if (pesananError) return { error: pesananError.message }

  const { error: itemsError } = await supabase
    .from('item_pesanan')
    .insert(
      input.items.map((item) => ({
        pesanan_id: pesanan.id,
        produk_id: item.produk_id,
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
