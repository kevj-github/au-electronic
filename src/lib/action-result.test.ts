import { describe, it, expect, vi } from 'vitest'
import { setErrorFromResult } from './action-result'

/**
 * `setErrorFromResult` is called from 13+ components (ItemsSection, OrderForm,
 * PaymentModal, ConfirmDeleteButton, ...) but had no direct test of its own —
 * only indirect coverage through one component test. Pin its contract
 * directly: it must call `setError` (and return true) only when `result`
 * carries a truthy `error`, and otherwise return false without touching
 * `setError` at all.
 */

describe('setErrorFromResult', () => {
  it('calls setError with the message and returns true when result has an error', () => {
    const setError = vi.fn()

    const bailed = setErrorFromResult({ error: 'Gagal menyimpan.' }, setError)

    expect(bailed).toBe(true)
    expect(setError).toHaveBeenCalledWith('Gagal menyimpan.')
    expect(setError).toHaveBeenCalledTimes(1)
  })

  it('does not call setError and returns false when result has no error field', () => {
    const setError = vi.fn()

    const bailed = setErrorFromResult({}, setError)

    expect(bailed).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it('does not call setError and returns false when result carries success data alongside no error', () => {
    const setError = vi.fn()

    const bailed = setErrorFromResult({ pesananId: 'p1' }, setError)

    expect(bailed).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it('does not call setError and returns false when result is undefined', () => {
    const setError = vi.fn()

    const bailed = setErrorFromResult(undefined, setError)

    expect(bailed).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })

  it('treats an empty-string error as falsy and does not call setError', () => {
    const setError = vi.fn()

    const bailed = setErrorFromResult({ error: '' }, setError)

    expect(bailed).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })
})
