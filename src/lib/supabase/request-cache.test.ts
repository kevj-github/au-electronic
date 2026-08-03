import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Note on what is *not* covered here: the `cache()` wrapper deduplicates calls
 * only within a React render scope, which a plain test does not provide, so the
 * one-round-trip-per-request property is not observable from here. It is React
 * runtime behaviour rather than logic in this file; these tests cover the logic.
 *
 * `getPesananLocked` decides whether helpers see the locked UI. It used to read
 * `data?.value === 'true'`, so a failed or missing settings read produced
 * `false` — the *unlocked* UI — even though `requireUnlocked` in the action
 * layer already rejects every mutation those affordances trigger. These tests
 * pin the fail-closed direction so the two layers can't drift apart again.
 */

const single = vi.fn()
const getUser = vi.fn()
const from = vi.fn(() => ({ select: () => ({ eq: () => ({ single }) }) }))

vi.mock('./server', () => ({
  createClient: async () => ({ from, auth: { getUser } }),
}))

// React's cache() memoizes per request; importing fresh per test avoids one
// case's result leaking into the next.
async function load() {
  vi.resetModules()
  return import('./request-cache')
}

async function loadGetPesananLocked() {
  return (await load()).getPesananLocked
}

beforeEach(() => {
  single.mockReset()
  from.mockClear()
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'auth-1' } } })
})

describe('getPesananLocked', () => {
  it('reports locked when the setting is "true"', async () => {
    single.mockResolvedValue({ data: { value: 'true' }, error: null })
    const getPesananLocked = await loadGetPesananLocked()

    expect(await getPesananLocked()).toBe(true)
  })

  it('reports unlocked when the setting is "false"', async () => {
    single.mockResolvedValue({ data: { value: 'false' }, error: null })
    const getPesananLocked = await loadGetPesananLocked()

    expect(await getPesananLocked()).toBe(false)
  })

  it('fails closed when the settings read errors', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'connection reset' } })
    const getPesananLocked = await loadGetPesananLocked()

    expect(await getPesananLocked()).toBe(true)
  })

  it('fails closed when the settings row is missing', async () => {
    single.mockResolvedValue({ data: null, error: null })
    const getPesananLocked = await loadGetPesananLocked()

    expect(await getPesananLocked()).toBe(true)
  })

  it('treats any value other than "true" as unlocked', async () => {
    single.mockResolvedValue({ data: { value: 'TRUE' }, error: null })
    const getPesananLocked = await loadGetPesananLocked()

    // The seed row stores lowercase; anything else is not the locked sentinel.
    expect(await getPesananLocked()).toBe(false)
  })
})

describe('getAuthUser', () => {
  it('returns the session user', async () => {
    const { getAuthUser } = await load()

    expect(await getAuthUser()).toEqual({ id: 'auth-1' })
  })

  it('returns null when there is no session', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { getAuthUser } = await load()

    expect(await getAuthUser()).toBeNull()
  })

})

describe('getCurrentUser', () => {
  it('resolves the users row for the authenticated caller', async () => {
    single.mockResolvedValue({ data: { id: 'auth-1', role: 'owner', nama: 'Bos', email: 'a@b.c' } })
    const { getCurrentUser } = await load()

    expect(await getCurrentUser()).toMatchObject({ role: 'owner' })
    expect(from).toHaveBeenCalledWith('users')
  })

  it('returns null without querying users when unauthenticated', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { getCurrentUser } = await load()

    expect(await getCurrentUser()).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('returns null when the caller has no users row', async () => {
    single.mockResolvedValue({ data: null })
    const { getCurrentUser } = await load()

    // Pages treat null as "not signed in" and redirect to /login.
    expect(await getCurrentUser()).toBeNull()
  })
})
