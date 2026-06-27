import { cache } from 'react'
import { createClient } from './server'
import type { User } from '@/lib/types'

// React cache() deduplicates calls with the same args within one React render
// tree (one request). Layout + every page both query auth/user; with these
// helpers, only ONE round-trip fires per request regardless of how many Server
// Components call them.

export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCurrentUser = cache(async () => {
  const authUser = await getAuthUser()
  if (!authUser) return null
  const supabase = await createClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, role, nama, email')
    .eq('id', authUser.id)
    .single<Pick<User, 'id' | 'role' | 'nama' | 'email'>>()
  return user
})

export const getPesananLocked = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pesanan_locked')
    .single<{ value: string }>()
  return data?.value === 'true'
})
