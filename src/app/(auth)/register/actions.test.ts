import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `registerOwner` is reachable from a public, unauthenticated route and is
 * meant to work exactly once — the bootstrap that creates the first `owner`
 * account. The `count` lookup guarding that is the only thing standing
 * between the open route and minting extra owner accounts.
 *
 * `count` is typed `number | null` even on a successful response (it comes
 * from the content-range header, not the payload), so a check that only
 * blocks on `count > 0` falls through to "allowed" when count comes back
 * null without an error. These tests pin the fail-closed direction: an
 * unreadable count refuses registration instead of allowing it.
 */

const select = vi.fn()
const insert = vi.fn()
const createUser = vi.fn()
const deleteUser = vi.fn()
const signInWithPassword = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ select, insert }),
    auth: { admin: { createUser, deleteUser } },
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword } }),
}))

async function loadRegisterOwner() {
  vi.resetModules()
  const mod = await import('./actions')
  return mod.registerOwner
}

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const validForm = () =>
  formData({ nama: 'Budi', email: 'budi@example.com', password: 'rahasia' })

beforeEach(() => {
  select.mockReset()
  insert.mockReset().mockResolvedValue({ error: null })
  createUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  deleteUser.mockReset().mockResolvedValue({ error: null })
  signInWithPassword.mockReset().mockResolvedValue({ error: null })
})

describe('registerOwner', () => {
  it('registers the first owner when the count is confirmed zero', async () => {
    select.mockResolvedValue({ count: 0, error: null })
    const registerOwner = await loadRegisterOwner()

    expect(await registerOwner(validForm())).toEqual({})
    expect(createUser).toHaveBeenCalled()
  })

  it('refuses when an account already exists', async () => {
    select.mockResolvedValue({ count: 1, error: null })
    const registerOwner = await loadRegisterOwner()

    const result = await registerOwner(validForm())

    expect(result.error).toBeTruthy()
    expect(createUser).not.toHaveBeenCalled()
  })

  it('refuses when the count comes back null without an error — never falls through to open registration', async () => {
    select.mockResolvedValue({ count: null, error: null })
    const registerOwner = await loadRegisterOwner()

    const result = await registerOwner(validForm())

    expect(result.error).toBeTruthy()
    expect(createUser).not.toHaveBeenCalled()
  })

  it('refuses when the count lookup errors', async () => {
    select.mockResolvedValue({ count: null, error: { message: 'connection reset' } })
    const registerOwner = await loadRegisterOwner()

    const result = await registerOwner(validForm())

    expect(result.error).toBeTruthy()
    expect(createUser).not.toHaveBeenCalled()
  })
})
