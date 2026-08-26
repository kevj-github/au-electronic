'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import type { ActionResult } from '@/lib/action-result'
import type { MetodePembayaran } from '@/lib/types'

export async function createPembayaran(
  pesananId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // Still needed for dicatat_oleh; requireOwner already rejected anonymous callers.
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const jumlah = Number(formData.get('jumlah'))
  const metode = formData.get('metode') as MetodePembayaran
  const catatan = formData.get('catatan') as string
  const dibayar_pada = formData.get('dibayar_pada') as string

  // Covers NaN, 0 and negatives — Number('') and Number('abc') are 0 and NaN.
  if (!Number.isFinite(jumlah) || jumlah <= 0) {
    return { error: 'Jumlah pembayaran tidak valid.' }
  }
  if (!metode) return { error: 'Pilih metode pembayaran.' }

  const { error } = await supabase.from('pembayaran').insert({
    pesanan_id: pesananId,
    jumlah,
    metode,
    catatan: catatan || null,
    dibayar_pada: dibayar_pada || new Date().toISOString(),
    dicatat_oleh: authUser.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}

export async function deletePembayaran(pembayaranId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // Derive the parent pesanan from the payment row rather than trusting a
  // client-supplied id — the same rule the item actions follow. Here it decides
  // which path gets revalidated, so a stale value would refresh the wrong page.
  const { data: pembayaran } = await supabase
    .from('pembayaran')
    .select('pesanan_id')
    .eq('id', pembayaranId)
    .single<{ pesanan_id: string }>()

  if (!pembayaran) return { error: 'Pembayaran tidak ditemukan.' }

  const { error } = await supabase.from('pembayaran').delete().eq('id', pembayaranId)
  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pembayaran.pesanan_id}`)
  return {}
}
