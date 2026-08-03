import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `getPesananLocked` decides whether helpers see the locked UI. It used to read
 * `data?.value === 'true'`, so a failed or missing settings read produced
 * `false` — the *unlocked* UI — even though `checkHelperLock` in the action
 * layer already rejects every mutation those affordances trigger. These tests
 * pin the fail-closed direction so the two layers can't drift apart again.
 */

const single = vi.fn()

vi.mock('./server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single }),
      }),
    }),
  }),
}))

// React's cache() memoizes per request; importing fresh per test avoids one
// case's result leaking into the next.
async function loadGetPesananLocked() {
  vi.resetModules()
  const mod = await import('./request-cache')
  return mod.getPesananLocked
}

beforeEach(() => {
  single.mockReset()
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
