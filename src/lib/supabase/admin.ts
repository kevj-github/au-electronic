import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Bypasses RLS via the service-role key — only import from server-only files.
export function createAdminClient() {
  return createClient<Database>(
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
