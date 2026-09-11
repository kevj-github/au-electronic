import { describe, it, expect } from 'vitest'
import { getFormString, getFormStringOrNull } from './form-data'

function formWith(entries: Record<string, string | File>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) fd.set(k, v)
  return fd
}

describe('getFormString', () => {
  it('returns the string value when present', () => {
    expect(getFormString(formWith({ nama: 'Toko A' }), 'nama')).toBe('Toko A')
  })

  it('returns an empty string when the field is missing', () => {
    expect(getFormString(new FormData(), 'nama')).toBe('')
  })

  it('returns an empty string when the field is a File, not text', () => {
    const file = new File(['x'], 'x.txt')
    expect(getFormString(formWith({ nama: file }), 'nama')).toBe('')
  })
})

describe('getFormStringOrNull', () => {
  it('returns the string value when present, including an empty string', () => {
    expect(getFormStringOrNull(formWith({ id: 'c1' }), 'id')).toBe('c1')
    expect(getFormStringOrNull(formWith({ id: '' }), 'id')).toBe('')
  })

  it('returns null when the field is missing', () => {
    expect(getFormStringOrNull(new FormData(), 'id')).toBeNull()
  })

  it('returns null when the field is a File, not text', () => {
    const file = new File(['x'], 'x.txt')
    expect(getFormStringOrNull(formWith({ id: file }), 'id')).toBeNull()
  })
})
