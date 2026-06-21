'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MetodePembayaran, User } from '@/lib/types'

export async function createPembayaran(
  pesananId: string,
  formData: FormData
) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') return { error: 'Hanya pemilik yang bisa mencatat pembayaran.' }

  const jumlah = Number(formData.get('jumlah'))
  const metode = formData.get('metode') as MetodePembayaran
  const catatan = formData.get('catatan') as string
  const dibayar_pada = formData.get('dibayar_pada') as string

  if (!jumlah || jumlah <= 0) return { error: 'Jumlah pembayaran tidak valid.' }
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

export async function deletePembayaran(pembayaranId: string, pesananId: string) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Tidak terautentikasi.' }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') return { error: 'Hanya pemilik yang bisa menghapus pembayaran.' }

  const { error } = await supabase.from('pembayaran').delete().eq('id', pembayaranId)
  if (error) return { error: error.message }

  revalidatePath(`/pesanan/${pesananId}`)
  return {}
}
