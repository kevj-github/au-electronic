'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwner } from '@/lib/supabase/require-owner'
import type { User } from '@/lib/types'

export async function createUser(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const nama = formData.get('nama') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string

  if (!nama || !email || !password) {
    return { error: 'Nama, email, dan password wajib diisi.' }
  }
  if (password.length < 6) {
    return { error: 'Password minimal 6 karakter.' }
  }
  if (role !== 'owner' && role !== 'helper') {
    return { error: 'Role tidak valid.' }
  }

  const adminClient = createAdminClient()

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) return { error: createError.message }

  const { error: insertError } = await adminClient.from('users').insert({
    id: created.user.id,
    email,
    nama,
    role,
  })
  if (insertError) {
    // Roll back the auth user so it doesn't become an orphan invisible to this UI.
    await adminClient.auth.admin.deleteUser(created.user.id)
    return { error: insertError.message }
  }

  revalidatePath('/pengaturan')
  return {}
}

export async function deleteHelper(userId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const { data: targetUser } = await supabase
    .from('users').select('role').eq('id', userId).single<Pick<User, 'role'>>()
  if (targetUser?.role === 'owner') {
    return { error: 'Tidak bisa menghapus akun owner.' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath('/pengaturan')
  return {}
}

export async function clearAllPesanan(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // item_pesanan and pembayaran cascade via FK ON DELETE CASCADE
  const { error } = await supabase.from('pesanan').delete().not('id', 'is', null)
  if (error) return { error: error.message }

  revalidatePath('/pesanan')
  return {}
}

export async function clearAllPelanggan(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // Gather all pelanggan names first so linked pesanan don't lose the customer name
  const { data: pelangganList } = await supabase
    .from('pelanggan').select('id, nama').returns<Array<{ id: string; nama: string }>>()

  await Promise.all(
    (pelangganList ?? []).map((p) =>
      supabase
        .from('pesanan')
        .update({ pelanggan_id: null, nama_pelanggan: p.nama })
        .eq('pelanggan_id', p.id)
    )
  )

  const { error } = await supabase.from('pelanggan').delete().not('id', 'is', null)
  if (error) return { error: error.message }

  revalidatePath('/pelanggan')
  revalidatePath('/pesanan')
  return {}
}

export async function setPesananLocked(locked: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const { error } = await supabase
    .from('settings')
    .update({ value: locked ? 'true' : 'false' })
    .eq('key', 'pesanan_locked')

  if (error) return { error: error.message }
  revalidatePath('/pengaturan')
  return {}
}
