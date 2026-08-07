import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `connectQz` exists because `isActive()` returns true while the socket is
 * still CONNECTING. A second caller that only checked it would skip
 * `connect()` and print against a socket that isn't open — reachable by
 * clicking "Deteksi Printer" then "Cetak Epson" in quick succession.
 *
 * That race is the whole reason the module holds an in-flight promise, and it
 * had no coverage. These tests drive the concurrent path directly.
 */

const connect = vi.fn()
const isActive = vi.fn()
const setCertificatePromise = vi.fn()
const setSignaturePromise = vi.fn()

vi.mock('qz-tray', () => ({
  default: {
    security: { setCertificatePromise, setSignaturePromise },
    websocket: { isActive, connect: (...a: unknown[]) => connect(...a) },
  },
}))

/** Fresh module per test — the memoised promises are module-level state. */
async function loadQz() {
  vi.resetModules()
  return import('./qz')
}

/** A promise plus the handle to settle it, for driving the in-flight window. */
function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  connect.mockReset().mockResolvedValue(undefined)
  isActive.mockReset().mockReturnValue(false)
  setCertificatePromise.mockReset()
  setSignaturePromise.mockReset()
})

describe('connectQz', () => {
  it('configures unsigned mode once, on first load', async () => {
    const { connectQz } = await loadQz()

    await connectQz()
    await connectQz()

    expect(setCertificatePromise).toHaveBeenCalledTimes(1)
    expect(setSignaturePromise).toHaveBeenCalledTimes(1)
  })

  it('connects when the socket is not active', async () => {
    const { connectQz } = await loadQz()

    await connectQz()

    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('skips connect when the socket is already active', async () => {
    isActive.mockReturnValue(true)
    const { connectQz } = await loadQz()

    await connectQz()

    expect(connect).not.toHaveBeenCalled()
  })

  it('collapses concurrent callers onto a single connect()', async () => {
    const gate = deferred()
    connect.mockReturnValue(gate.promise)
    const { connectQz } = await loadQz()

    // Both start while the socket is still CONNECTING.
    const first = connectQz()
    const second = connectQz()
    gate.resolve()
    await Promise.all([first, second])

    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('makes the second caller wait for the in-flight connect, not race past it', async () => {
    const gate = deferred()
    connect.mockReturnValue(gate.promise)
    const { connectQz } = await loadQz()

    const order: string[] = []
    const first = connectQz().then(() => order.push('first'))
    const second = connectQz().then(() => order.push('second'))

    // Neither may resolve while the socket is still opening.
    await Promise.resolve()
    expect(order).toEqual([])

    gate.resolve()
    await Promise.all([first, second])
    expect(order).toHaveLength(2)
  })

  it('clears the in-flight promise after a failure so a retry can reconnect', async () => {
    connect.mockRejectedValueOnce(new Error('QZ Tray not running'))
    const { connectQz } = await loadQz()

    await expect(connectQz()).rejects.toThrow('QZ Tray not running')

    // The finally block must have released the latch.
    connect.mockResolvedValue(undefined)
    await connectQz()
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('returns the same qz client to every caller', async () => {
    const { connectQz } = await loadQz()

    const [a, b] = await Promise.all([connectQz(), connectQz()])

    expect(a).toBe(b)
  })
})
