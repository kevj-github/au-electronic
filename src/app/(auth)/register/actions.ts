'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function registerOwner(formData: FormData): Promise<{ error?: string }> {
  const nama = formData.get('nama') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!nama || !email || !password) {
    return { error: 'Nama, email, dan password wajib diisi.' }
  }
  if (password.length < 6) {
    return { error: 'Password minimal 6 karakter.' }
  }

  const adminClient = createAdminClient()

  // Bootstrap-only: once any account exists, registration closes and
  // further accounts must be created by the owner via /pengaturan.
  const { count, error: countError } = await adminClient
    .from('users')
    .select('id', { count: 'exact', head: true })
  if (countError) return { error: countError.message }
  if (count && count > 0) {
    return { error: 'Registrasi ditutup. Hubungi pemilik untuk dibuatkan akun.' }
  }

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
    role: 'owner',
  })
  if (insertError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return { error: insertError.message }
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) return { error: signInError.message }

  return {}
}
