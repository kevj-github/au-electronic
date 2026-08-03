import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `deleteHelper`'s role lookup is the only thing preventing an owner account
 * from being deleted, and the deletion it guards runs through the service-role
 * admin client, which bypasses RLS entirely.
 *
 * It used to read the role with `targetUser?.role === 'owner'` and no error
 * check, so a failed lookup produced `null` — which is not `'owner'` — and the
 * delete went ahead. These tests pin the fail-closed direction: no confirmed
 * role, no deletion.
 */

const single = vi.fn()
const deleteUser = vi.fn()
const requireOwner = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser } } }),
}))

vi.mock('@/lib/supabase/require-owner', () => ({
  requireOwner: (...args: unknown[]) => requireOwner(...args),
}))

async function loadDeleteHelper() {
  vi.resetModules()
  const mod = await import('./actions')
  return mod.deleteHelper
}

beforeEach(() => {
  single.mockReset()
  deleteUser.mockReset().mockResolvedValue({ error: null })
  requireOwner.mockReset().mockResolvedValue(null)
})

describe('deleteHelper', () => {
  it('deletes a confirmed helper', async () => {
    single.mockResolvedValue({ data: { role: 'helper' }, error: null })
    const deleteHelper = await loadDeleteHelper()

    expect(await deleteHelper('helper-1')).toEqual({})
    expect(deleteUser).toHaveBeenCalledWith('helper-1')
  })

  it('refuses to delete a confirmed owner', async () => {
    single.mockResolvedValue({ data: { role: 'owner' }, error: null })
    const deleteHelper = await loadDeleteHelper()

    expect(await deleteHelper('owner-1')).toEqual({
      error: 'Tidak bisa menghapus akun owner.',
    })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('refuses when the role lookup errors — never falls through to the delete', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'connection reset' } })
    const deleteHelper = await loadDeleteHelper()

    const result = await deleteHelper('who-knows')

    expect(result.error).toBeTruthy()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('refuses when the target has no users row', async () => {
    single.mockResolvedValue({ data: null, error: null })
    const deleteHelper = await loadDeleteHelper()

    const result = await deleteHelper('ghost')

    expect(result.error).toBeTruthy()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('rejects a non-owner caller before looking anything up', async () => {
    requireOwner.mockResolvedValue({ error: 'Hanya owner yang dapat melakukan aksi ini.' })
    const deleteHelper = await loadDeleteHelper()

    expect(await deleteHelper('helper-1')).toEqual({
      error: 'Hanya owner yang dapat melakukan aksi ini.',
    })
    expect(single).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })
})
