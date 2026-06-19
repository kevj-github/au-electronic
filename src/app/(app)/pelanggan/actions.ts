'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'

export async function upsertPelanggan(formData: FormData) {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const id = formData.get('id') as string | null
  const nama = formData.get('nama') as string
  const telepon = formData.get('telepon') as string
  const alamat = formData.get('alamat') as string
  const tipe = formData.get('tipe') as 'retail' | 'grosir'

  if (!nama) return { error: 'Nama pelanggan wajib diisi.' }

  if (id) {
    const { error } = await supabase
      .from('pelanggan')
      .update({ nama, telepon: telepon || null, alamat: alamat || null, tipe })
      .eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('pelanggan')
      .insert({ nama, telepon: telepon || null, alamat: alamat || null, tipe })
    if (error) return { error: error.message }
  }

  revalidatePath('/pelanggan')
  redirect('/pelanggan')
}
