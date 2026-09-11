import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `createUser` had no test coverage at all (lines 12-54 of actions.ts unhit in
 * `npm run coverage`), despite being the one action here that talks to two
 * separate stores — Supabase Auth and the `users` table — and has to keep them
 * in sync by hand. These tests pin the validation order, the auth-error path,
 * and the rollback: an insert failure after auth user creation must delete the
 * just-created auth user so it doesn't become an orphan invisible to this UI.
 */

const revalidatePath = vi.fn()
const requireOwner = vi.fn()
const authCreateUser = vi.fn()
const authDeleteUser = vi.fn()
const insert = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: authCreateUser, deleteUser: authDeleteUser } },
    from: () => ({ insert }),
  }),
}))
vi.mock('@/lib/supabase/require-owner', () => ({
  requireOwner: (...a: unknown[]) => requireOwner(...a),
}))

const OWNER_ERROR = { error: 'Hanya owner yang dapat melakukan aksi ini.' }

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const validFields = { nama: 'Budi', email: 'budi@example.com', password: 'rahasia', role: 'helper' }

async function actions() {
  vi.resetModules()
  return import('./actions')
}

beforeEach(() => {
  revalidatePath.mockReset()
  requireOwner.mockReset().mockResolvedValue(null)
  authCreateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  authDeleteUser.mockReset().mockResolvedValue({ error: null })
  insert.mockReset().mockResolvedValue({ error: null })
})

describe('createUser', () => {
  it('refuses a non-owner before validating or writing anything', async () => {
    requireOwner.mockResolvedValue(OWNER_ERROR)
    const { createUser } = await actions()

    expect(await createUser(form(validFields))).toEqual(OWNER_ERROR)
    expect(authCreateUser).not.toHaveBeenCalled()
  })

  it.each([
    ['nama', { ...validFields, nama: '' }],
    ['email', { ...validFields, email: '' }],
    ['password', { ...validFields, password: '' }],
  ])('requires %s to be present', async (_field, fields) => {
    const { createUser } = await actions()

    const result = await createUser(form(fields))

    expect(result.error).toBe('Nama, email, dan password wajib diisi.')
    expect(authCreateUser).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 6 characters', async () => {
    const { createUser } = await actions()

    const result = await createUser(form({ ...validFields, password: '12345' }))

    expect(result.error).toBe('Password minimal 6 karakter.')
    expect(authCreateUser).not.toHaveBeenCalled()
  })

  it('rejects a role that is neither owner nor helper', async () => {
    const { createUser } = await actions()

    const result = await createUser(form({ ...validFields, role: 'admin' }))

    expect(result.error).toBe('Role tidak valid.')
    expect(authCreateUser).not.toHaveBeenCalled()
  })

  it.each([['owner'], ['helper']])('accepts the %s role', async (role) => {
    const { createUser } = await actions()

    expect(await createUser(form({ ...validFields, role }))).toEqual({})
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ role }))
  })

  it('surfaces an auth createUser error without touching the users table', async () => {
    authCreateUser.mockResolvedValue({ data: null, error: { message: 'email already registered' } })
    const { createUser } = await actions()

    const result = await createUser(form(validFields))

    expect(result).toEqual({ error: 'email already registered' })
    expect(insert).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rolls back the auth user when the users insert fails', async () => {
    insert.mockResolvedValue({ error: { message: 'duplicate key value' } })
    const { createUser } = await actions()

    const result = await createUser(form(validFields))

    expect(result).toEqual({ error: 'duplicate key value' })
    expect(authDeleteUser).toHaveBeenCalledWith('u1')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('creates the user and revalidates /pengaturan on success', async () => {
    const { createUser } = await actions()

    const result = await createUser(form(validFields))

    expect(result).toEqual({})
    expect(insert).toHaveBeenCalledWith({
      id: 'u1',
      email: validFields.email,
      nama: validFields.nama,
      role: validFields.role,
    })
    expect(authDeleteUser).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/pengaturan')
  })
})
