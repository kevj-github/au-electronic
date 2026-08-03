import { describe, it, expect, vi } from 'vitest'
import { requireOwner } from './require-owner'

/**
 * `requireOwner` is the app-layer half of every owner-gated action — roughly
 * fifteen call sites. RLS is the real boundary, but this is what produces the
 * error the user actually sees, and it had no coverage at all.
 *
 * The cases that matter are the negative ones: it must return an error object
 * (never null) for anonymous callers, helpers, and callers whose `users` row
 * can't be read. `null` means "proceed".
 */
function mockClient(row: { role: string } | null, authUserId: string | null = 'user-1') {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: row })),
  }
  return {
    from: vi.fn(() => builder),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUserId ? { id: authUserId } : null },
      })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('requireOwner', () => {
  it('returns null for an owner, meaning proceed', async () => {
    expect(await requireOwner(mockClient({ role: 'owner' }))).toBeNull()
  })

  it('rejects a helper', async () => {
    const result = await requireOwner(mockClient({ role: 'helper' }))

    expect(result).toEqual({ error: 'Hanya owner yang dapat melakukan aksi ini.' })
  })

  it('rejects an anonymous caller without querying users', async () => {
    const supabase = mockClient({ role: 'owner' }, null)

    expect(await requireOwner(supabase)).toEqual({ error: 'Anda belum login.' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('rejects a signed-in caller whose users row is missing', async () => {
    // Fail closed: no row means no confirmed role, which is not owner.
    expect(await requireOwner(mockClient(null))).toEqual({
      error: 'Hanya owner yang dapat melakukan aksi ini.',
    })
  })

  it('looks the role up by the authenticated user id, not anything passed in', async () => {
    const supabase = mockClient({ role: 'owner' }, 'auth-42')

    await requireOwner(supabase)

    expect(supabase.from).toHaveBeenCalledWith('users')
    expect(supabase.from().eq).toHaveBeenCalledWith('id', 'auth-42')
  })
})
