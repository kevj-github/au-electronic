'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import { getFormString, getFormStringOrNull } from '@/lib/form-data'
import type { ActionResult } from '@/lib/action-result'
import type { TipePelanggan } from '@/lib/types'

export async function deletePelanggan(pelangganId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const { data: pelanggan } = await supabase
    .from('pelanggan').select('nama').eq('id', pelangganId).single<{ nama: string }>()
  if (!pelanggan) return { error: 'Pelanggan tidak ditemukan.' }

  // Preserve the name in any linked pesanan before breaking the FK
  const { error: unlinkError } = await supabase
    .from('pesanan')
    .update({ pelanggan_id: null, nama_pelanggan: pelanggan.nama })
    .eq('pelanggan_id', pelangganId)
  if (unlinkError) return { error: unlinkError.message }

  const { error } = await supabase.from('pelanggan').delete().eq('id', pelangganId)
  if (error) return { error: error.message }

  revalidatePath('/pelanggan')
  revalidatePath('/pesanan')
  return {}
}

// Returns undefined on success rather than `{}` — the happy path ends in
// `redirect()`, which throws.
export async function upsertPelanggan(
  formData: FormData
): Promise<ActionResult | undefined> {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const id = getFormStringOrNull(formData, 'id')
  const nama = getFormString(formData, 'nama')
  const telepon = getFormString(formData, 'telepon')
  const alamat = getFormString(formData, 'alamat')
  const tipe = getFormString(formData, 'tipe') as TipePelanggan

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
