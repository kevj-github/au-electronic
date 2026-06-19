'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'

export async function upsertProduk(formData: FormData) {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const id = formData.get('id') as string | null
  const nama = formData.get('nama') as string
  const deskripsi = formData.get('deskripsi') as string
  const satuan = formData.get('satuan') as string
  const harga_dasar = Number(formData.get('harga_dasar'))

  if (!nama || !satuan || isNaN(harga_dasar)) {
    return { error: 'Data produk tidak lengkap.' }
  }

  if (id) {
    const { error } = await supabase
      .from('produk')
      .update({ nama, deskripsi, satuan, harga_dasar })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('produk')
      .insert({ nama, deskripsi, satuan, harga_dasar })
    if (error) return { error: error.message }
  }

  revalidatePath('/produk')
  redirect('/produk')
}

export async function toggleAktifProduk(id: string, aktif: boolean) {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const { error } = await supabase
    .from('produk')
    .update({ aktif: !aktif })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/produk')
}
