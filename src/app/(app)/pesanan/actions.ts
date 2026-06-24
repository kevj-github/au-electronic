'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

  const { data: pesanan, error: pesananError } = await supabase
    .from('pesanan')
    .insert({
      kode_pesanan: kodeData as string,
      pelanggan_id: input.pelanggan_id,
      nama_pelanggan: input.nama_pelanggan,
      catatan: input.catatan,
      dibuat_oleh: authUser.id,
      status: 'draft',
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

export interface UpdateItemHargaInput {
  itemId: string
  pesananId: string
  harga_satuan: number
  diskon: number
}

export async function updateItemHarga({ itemId, pesananId, harga_satuan, diskon }: UpdateItemHargaInput) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<{ role: string }>()
  if (user?.role !== 'owner') return { error: 'Hanya pemilik yang bisa mengubah harga.' }

  const { error } = await supabase
    .from('item_pesanan')
    .update({ harga_satuan, diskon })
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  revalidatePath('/pesanan')
  return {}
}
