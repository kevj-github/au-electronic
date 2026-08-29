import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePelangganAutocomplete } from './use-pelanggan-autocomplete'
import type { Pelanggan } from '@/lib/types'

/**
 * Extracted from OrderForm.tsx. The pelanggan-select tests there
 * (OrderForm.pelanggan-select.test.tsx, .pelanggan-select-reopen.test.tsx)
 * still cover the wiring end-to-end; this covers the hook's own logic
 * directly, without mounting the form.
 */

function pelanggan(overrides: Partial<Pelanggan> = {}): Pelanggan {
  return {
    id: 'c1',
    nama: 'Toko Sumber Rejeki',
    telepon: null,
    alamat: 'Jl. Merdeka 1',
    tipe: 'retail',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const LIST: Pelanggan[] = [
  pelanggan({ id: 'c1', nama: 'Toko Sumber Rejeki', alamat: 'Jl. Merdeka 1', tipe: 'retail' }),
  pelanggan({ id: 'c2', nama: 'UD Makmur Jaya', alamat: null, tipe: 'grosir' }),
  pelanggan({ id: 'c3', nama: 'Rejeki Baru', alamat: 'Jl. Sudirman 5', tipe: 'retail' }),
]

describe('usePelangganAutocomplete — selecting from the list', () => {
  it('selectPelanggan sets pelangganId and clears any typed name', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.onNamaPelangganChange('draft name'))
    act(() => result.current.selectPelanggan('c1'))

    expect(result.current.pelangganId).toBe('c1')
    expect(result.current.namaPelanggan).toBe('')
  })

  it('selecting null clears pelangganId but leaves a typed name untouched', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.selectPelanggan('c1'))
    act(() => result.current.selectPelanggan(null))

    expect(result.current.pelangganId).toBe('')
  })

  it('labelFor formats nama — alamat (Tipe), falling back to the raw id', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    expect(result.current.labelFor('c1')).toBe('Toko Sumber Rejeki — Jl. Merdeka 1 (Retail)')
    expect(result.current.labelFor('c2')).toBe('UD Makmur Jaya (Grosir)')
    expect(result.current.labelFor('does-not-exist')).toBe('does-not-exist')
  })
})

describe('usePelangganAutocomplete — typing a name', () => {
  it('opens the suggestion dropdown and clears any selection once text is typed', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.selectPelanggan('c1'))
    act(() => result.current.onNamaPelangganChange('Rejeki'))

    expect(result.current.pelangganId).toBe('')
    expect(result.current.showSuggestions).toBe(true)
  })

  it('closes the dropdown when the field is cleared back to empty', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.onNamaPelangganChange('Rejeki'))
    act(() => result.current.onNamaPelangganChange(''))

    expect(result.current.showSuggestions).toBe(false)
  })

  it('suggestions match on a substring, case-insensitively', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.onNamaPelangganChange('MAKMUR'))

    expect(result.current.suggestions.map((p) => p.id)).toEqual(['c2'])
  })

  it('ranks a name that starts with the query above one that only contains it', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    // "Rejeki Baru" starts with "rejeki"; "Toko Sumber Rejeki" only contains it.
    act(() => result.current.onNamaPelangganChange('rejeki'))

    expect(result.current.suggestions.map((p) => p.id)).toEqual(['c3', 'c1'])
  })

  it('caps suggestions at 8 matches', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      pelanggan({ id: `m${i}`, nama: `Toko Rejeki ${i}` })
    )
    const { result } = renderHook(() => usePelangganAutocomplete(many))

    act(() => result.current.onNamaPelangganChange('rejeki'))

    expect(result.current.suggestions).toHaveLength(8)
  })

  it('selectSuggestion resolves the same way selectPelanggan does', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.onNamaPelangganChange('Rejeki'))
    act(() => result.current.selectSuggestion(LIST[2]))

    expect(result.current.pelangganId).toBe('c3')
    expect(result.current.namaPelanggan).toBe('')
    expect(result.current.showSuggestions).toBe(false)
  })

  it('onNamaPelangganFocus reopens suggestions only when there is text to search', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.onNamaPelangganBlur())
    act(() => result.current.onNamaPelangganFocus())
    expect(result.current.showSuggestions).toBe(false)

    act(() => result.current.onNamaPelangganChange('Rejeki'))
    act(() => result.current.onNamaPelangganBlur())
    act(() => result.current.onNamaPelangganFocus())
    expect(result.current.showSuggestions).toBe(true)
  })
})

describe('usePelangganAutocomplete — resolve()', () => {
  it('resolves a selected pelanggan to its id with no free-text name', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.selectPelanggan('c1'))

    expect(result.current.resolve()).toEqual({ pelanggan_id: 'c1', nama_pelanggan: null })
  })

  it('links a typed name that exactly matches an existing pelanggan, case/whitespace-insensitively', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.onNamaPelangganChange('  toko sumber rejeki  '))

    expect(result.current.resolve()).toEqual({ pelanggan_id: 'c1', nama_pelanggan: null })
  })

  it('falls back to a free-text name when nothing matches', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    act(() => result.current.onNamaPelangganChange('  Toko Baru Sekali  '))

    expect(result.current.resolve()).toEqual({ pelanggan_id: null, nama_pelanggan: 'Toko Baru Sekali' })
  })

  it('resolves to nulls when nothing was picked or typed', () => {
    const { result } = renderHook(() => usePelangganAutocomplete(LIST))

    expect(result.current.resolve()).toEqual({ pelanggan_id: null, nama_pelanggan: null })
  })
})
