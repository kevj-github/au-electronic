import { describe, it, expect } from 'vitest'
import { getSectionTitle, navItems } from './nav-items'

describe('getSectionTitle', () => {
  it('returns the label of an exact top-level route match', () => {
    expect(getSectionTitle('/pesanan')).toBe('Pesanan')
    expect(getSectionTitle('/pelanggan')).toBe('Pelanggan')
    expect(getSectionTitle('/dashboard')).toBe('Dashboard')
    expect(getSectionTitle('/pengaturan')).toBe('Pengaturan')
  })

  it('matches a nested route under a nav item', () => {
    expect(getSectionTitle('/pesanan/abc-123')).toBe('Pesanan')
    expect(getSectionTitle('/pelanggan/baru')).toBe('Pelanggan')
  })

  it('falls back to "AU Electronic" for a route matching no nav item', () => {
    expect(getSectionTitle('/login')).toBe('AU Electronic')
    expect(getSectionTitle('/')).toBe('AU Electronic')
  })

  it('accepts a custom fallback', () => {
    expect(getSectionTitle('/login', 'Masuk')).toBe('Masuk')
  })

  it('does not match a route that merely shares a prefix without a "/" boundary', () => {
    // isActiveRoute requires an exact match or `href + '/'` — '/pesanan-arsip'
    // must not be treated as a nested route of '/pesanan'.
    expect(getSectionTitle('/pesanan-arsip')).toBe('AU Electronic')
  })

  it('every nav item is reachable: its own href resolves to its own label', () => {
    for (const item of navItems) {
      expect(getSectionTitle(item.href)).toBe(item.label)
    }
  })
})
