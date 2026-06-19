import type { createClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'

export async function requireOwner(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { error: 'Anda belum login.' }

  const { data: user } = await supabase
    .from('users').select('role').eq('id', authUser.id).single<Pick<User, 'role'>>()
  if (user?.role !== 'owner') return { error: 'Hanya owner yang dapat melakukan aksi ini.' }

  return null
}
