import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildFilename, errorMessage, loadImageBase64 } from './document-export'
import type { InvoiceData } from './invoice-data'

/**
 * Split out of DocumentButtons.tsx so these pure/fetch helpers can be tested
 * without mounting the component (see CLAUDE.md's DocumentButtons.tsx note).
 */

const base: InvoiceData = {
  kodePesanan: 'AU.2026.07.00042',
  tanggal: '2026-07-16T02:00:00.000Z',
  namaPelanggan: 'Budi',
  alamatPelanggan: 'Jl. Mawar 10',
  items: [],
  totalPesanan: 0,
  totalDibayar: 0,
  sisaTagihan: 0,
  catatan: null,
}

const data = (overrides: Partial<InvoiceData> = {}): InvoiceData => ({ ...base, ...overrides })

describe('buildFilename', () => {
  it('joins nama, alamat and the formatted tanggal with " - "', () => {
    expect(buildFilename(data())).toBe('Budi - Jl. Mawar 10 - 16 Jul 2026.pdf')
  })

  it('skips missing fields rather than leaving empty segments', () => {
    expect(buildFilename(data({ alamatPelanggan: undefined }))).toBe('Budi - 16 Jul 2026.pdf')
  })

  it('replaces filesystem-illegal characters with "-"', () => {
    expect(buildFilename(data({ namaPelanggan: 'Toko "A/B" <C>' }))).toBe(
      'Toko -A-B- -C- - Jl. Mawar 10 - 16 Jul 2026.pdf'
    )
  })

  it('falls back to just the formatted date when the name and alamat are both blank', () => {
    expect(buildFilename(data({ namaPelanggan: '', alamatPelanggan: undefined }))).toBe(
      '16 Jul 2026.pdf'
    )
  })
})

describe('errorMessage', () => {
  it('reads the message off an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('passes a plain string through unchanged', () => {
    expect(errorMessage('QZ Tray rejected the connection')).toBe('QZ Tray rejected the connection')
  })

  it('falls back to a generic message for anything else', () => {
    expect(errorMessage({ code: 42 })).toBe('penyebab tidak diketahui')
    expect(errorMessage(undefined)).toBe('penyebab tidak diketahui')
  })
})

describe('loadImageBase64', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('resolves to a data URL built from the fetched blob', async () => {
    const blob = new Blob(['fake-image-bytes'], { type: 'image/png' })
    global.fetch = vi.fn(async () => ({ blob: async () => blob })) as unknown as typeof fetch

    const result = await loadImageBase64('/test-only/success.png')

    expect(result).toMatch(/^data:/)
  })

  it('resolves to undefined when the fetch throws, without caching the failure', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const first = await loadImageBase64('/test-only/failure.png')
    expect(first).toBeUndefined()

    // A retry after the failure should hit fetch again, not a cached undefined.
    const blob = new Blob(['recovered'], { type: 'image/png' })
    global.fetch = vi.fn(async () => ({ blob: async () => blob })) as unknown as typeof fetch
    const second = await loadImageBase64('/test-only/failure.png')
    expect(second).toMatch(/^data:/)
  })

  it('caches a successful load so a second call does not refetch', async () => {
    const fetchSpy = vi.fn(async () => ({
      blob: async () => new Blob(['cached'], { type: 'image/png' }),
    }))
    global.fetch = fetchSpy as unknown as typeof fetch

    await loadImageBase64('/test-only/cached.png')
    await loadImageBase64('/test-only/cached.png')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
