import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client authenticated with the service-role key.
 *
 * This client bypasses RLS entirely and can call the Supabase Auth Admin API
 * (e.g. `auth.admin.createUser` / `auth.admin.deleteUser`). It must only ever
 * be imported from server-only files (Server Actions with `'use server'`),
 * never from a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
