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

  const { data: targetUser, error: lookupError } = await supabase
    .from('users').select('role').eq('id', userId).single<Pick<User, 'role'>>()

  // Fail closed. This lookup is the only thing standing between the caller and
  // deleting an owner account, and the deletion below goes through the
  // service-role admin client, which bypasses RLS. Reading the role with `?.`
  // and no error check meant a transient failure produced `null`, which is not
  // 'owner', which proceeded to delete. Refuse unless the role is confirmed.
  if (lookupError || !targetUser) {
    return { error: 'Tidak dapat memverifikasi akun yang akan dihapus.' }
  }
  if (targetUser.role === 'owner') {
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

  // One DB transaction: every linked order keeps its customer name and every
  // pelanggan row is removed, or neither happens.
  //
  // This replaced a select-then-update-per-row-then-delete sequence run from
  // here. That version read the pelanggan list unbounded, and PostgREST silently
  // caps a result set at 1000 rows — so past 1000 customers only the first 1000
  // had their name copied onto their orders, and the final delete then failed on
  // the pesanan_pelanggan_id_fkey (a plain FK, no ON DELETE clause) *after* those
  // name-copying updates had already committed. The operation could therefore
  // half-complete, leaving ~1000 orders detached from customers that still
  // existed. It also cost one round-trip per customer.
  const { error } = await supabase.rpc('clear_all_pelanggan')
  if (error) return { error: error.message }

  revalidatePath('/pelanggan')
  revalidatePath('/pesanan')
  return {}
}

export async function setPesananLocked(locked: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // `.update().eq()` matching zero rows is not an error, so a missing settings
  // row would report success while the lock silently stayed off. Ask for the
  // affected rows back and fail closed when there are none (see the fail-closed
  // settings convention) — same as updateEpsonPrinterName below.
  const { data, error } = await supabase
    .from('settings')
    .update({ value: locked ? 'true' : 'false' })
    .eq('key', 'pesanan_locked')
    .select('key')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Pengaturan kunci pesanan belum tersedia di database. Hubungi admin.' }
  }
  revalidatePath('/pengaturan')
  return {}
}

export async function updateEpsonPrinterName(name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  // `.update().eq()` matching zero rows is not an error, so a missing settings
  // row would report success while saving nothing. Ask for the affected rows back
  // and fail closed when there are none (see the fail-closed settings convention).
  const { data, error } = await supabase
    .from('settings')
    .update({ value: name })
    .eq('key', 'epson_printer_name')
    .select('key')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Pengaturan printer Epson belum tersedia di database. Hubungi admin.' }
  }
  revalidatePath('/pengaturan')
  return {}
}

export async function getEpsonPrinterName(): Promise<{ name: string; error?: string }> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return { name: '', error: ownerError.error }

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'epson_printer_name')
    .single<{ value: string }>()

  if (error) return { name: '', error: error.message }

  return { name: data?.value ?? '' }
}
