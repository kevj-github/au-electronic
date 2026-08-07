import type { createClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export const PESANAN_NOT_MODIFIABLE = 'Pesanan tidak dapat diubah.'
export const ITEM_NOT_FOUND = 'Item tidak ditemukan.'
export const NOT_AUTHENTICATED = 'Tidak terautentikasi.'
export const LOCK_UNVERIFIABLE = 'Tidak dapat memverifikasi status kunci pesanan.'
export const PESANAN_LOCKED = 'Pesanan sedang dikunci oleh pemilik.'
export const CREATE_PESANAN_LOCKED = 'Pembuatan pesanan baru sedang dikunci oleh pemilik.'

export interface ActivePesananByItem {
  pesanan_id: string
  qty: number
  status: string
}

export interface ActivePesanan {
  pesanan_id: string
  status: string
}

/**
 * Resolves an item's parent pesanan and asserts it is still `diproses`.
 *
 * Two invariants live here so no caller has to re-derive them:
 *
 *  - The parent `pesanan_id` is read from the DB using the item ID. A
 *    client-supplied `pesananId` is never trusted for authorization; a stale or
 *    malicious value could otherwise skip the status check or reveal a path.
 *  - The status check is enforced in the app layer as well as the DB. The
 *    `guard_item_pesanan_write` trigger blocks writes on closed orders for
 *    helpers, but the OWNER bypasses it entirely — without this an owner could
 *    mutate items on a selesai/dibatalkan order.
 *
 * Returns `{ error }` on failure, otherwise the resolved ids (including `qty`,
 * so checklist actions can clamp against the DB value rather than a client one).
 */
export async function requireActivePesananByItem(
  supabase: ServerClient,
  itemId: string
): Promise<{ error: string } | ActivePesananByItem> {
  const { data } = await supabase
    .from('item_pesanan')
    .select('pesanan_id, qty, pesanan:pesanan(status)')
    .eq('id', itemId)
    .single<{ pesanan_id: string; qty: number; pesanan: { status: string } | null }>()

  if (!data) return { error: ITEM_NOT_FOUND }
  if (!data.pesanan || data.pesanan.status !== 'diproses') {
    return { error: PESANAN_NOT_MODIFIABLE }
  }
  return { pesanan_id: data.pesanan_id, qty: data.qty, status: data.pesanan.status }
}

/** Asserts a pesanan exists and is still `diproses`. See the note above on why
 *  the app layer must check this even though the DB trigger does. */
export async function requireActivePesanan(
  supabase: ServerClient,
  pesananId: string
): Promise<{ error: string } | ActivePesanan> {
  const { data } = await supabase
    .from('pesanan')
    .select('status')
    .eq('id', pesananId)
    .single<{ status: string }>()

  if (!data || data.status !== 'diproses') return { error: PESANAN_NOT_MODIFIABLE }
  return { pesanan_id: pesananId, status: data.status }
}

/** Narrowing helper so call sites read as `if (isGuardError(x)) return x`. */
export function isGuardError<T extends object>(
  result: { error: string } | T
): result is { error: string } {
  return 'error' in result
}

/**
 * The caller's role, or null when unauthenticated. Use `requireOwner` for
 * owner-only gates; this exists for the branches that need to know the role
 * without rejecting non-owners (e.g. the helper-only pesanan lock).
 */
export async function getRole(supabase: ServerClient): Promise<string | null> {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single<Pick<User, 'role'>>()

  return data?.role ?? null
}

/**
 * The `pesanan_locked` setting, which gates helper mutations only — owners are
 * gated by order status instead, so they skip the read entirely.
 *
 * Fail-closed: a read error or a missing row means the `settings` table wasn't
 * seeded correctly, which is an infrastructure problem that should surface
 * rather than be swallowed as "not locked".
 *
 * Takes the role rather than fetching it so callers that already know it don't
 * pay for a second lookup. `lockedMessage` exists because creating a pesanan
 * phrases the rejection differently from editing one.
 */
export async function requireUnlocked(
  supabase: ServerClient,
  role: string | null,
  lockedMessage: string = PESANAN_LOCKED
): Promise<{ error: string } | null> {
  if (role === 'owner') return null

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'pesanan_locked')
    .single<{ value: string }>()

  if (error || !data) return { error: LOCK_UNVERIFIABLE }
  if (data.value === 'true') return { error: lockedMessage }
  return null
}

/**
 * The complete gate every helper-facing item mutation needs: authenticated,
 * not locked, and the parent pesanan still `diproses`. Resolves to the item's
 * parent ids on success so the caller can revalidate and clamp against `qty`.
 *
 * The role lookup and the item lookup are independent, so they run
 * concurrently. Doing this by hand at each call site had drifted: two actions
 * parallelized it, four serialized all three steps, and every one of them
 * validated the session twice (once directly, once inside the lock check).
 *
 * Error precedence is the one the call sites already used: auth, then lock,
 * then order status.
 */
export async function requireHelperCanMutateItem(
  supabase: ServerClient,
  itemId: string
): Promise<{ error: string } | ActivePesananByItem> {
  const [role, active] = await Promise.all([
    getRole(supabase),
    requireActivePesananByItem(supabase, itemId),
  ])

  // `getRole` is null both for a missing session and for a signed-in user with
  // no `users` row. Rejecting the second case too only matches what the DB
  // already does — `item_pesanan_update` is `using (current_user_role() is not
  // null)`, so such a caller cannot write regardless.
  if (role === null) return { error: NOT_AUTHENTICATED }

  const lockError = await requireUnlocked(supabase, role)
  if (lockError) return lockError

  return active
}

/** As `requireHelperCanMutateItem`, for actions keyed by the pesanan itself. */
export async function requireHelperCanMutatePesanan(
  supabase: ServerClient,
  pesananId: string
): Promise<{ error: string } | ActivePesanan> {
  const [role, active] = await Promise.all([
    getRole(supabase),
    requireActivePesanan(supabase, pesananId),
  ])

  if (role === null) return { error: NOT_AUTHENTICATED }

  const lockError = await requireUnlocked(supabase, role)
  if (lockError) return lockError

  return active
}
