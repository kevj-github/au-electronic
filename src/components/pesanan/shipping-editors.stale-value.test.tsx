import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollyEditor } from './CollyEditor'
import { PengirimanEditor } from './PengirimanEditor'
import { TanggalPengirimanEditor } from './TanggalPengirimanEditor'

/**
 * `[id]/page.tsx` mounts RealtimeRefresh on the pesanan row, so `initialValue`
 * genuinely changes underneath a mounted editor when another device saves.
 * Each editor's useState initialiser only runs once, so without a render-phase
 * resync (the same pattern ItemsSection's price field uses) a blur that fires
 * after such a refresh compares the stale displayed value against the fresh
 * initialValue and silently writes the stale value back over the other
 * device's save.
 */

const updateColly = vi.fn(async () => ({}) as { error?: string })
const updatePengiriman = vi.fn(async () => ({}) as { error?: string })
const updateTanggalPengiriman = vi.fn(async () => ({}) as { error?: string })

vi.mock('@/app/(app)/pesanan/actions', () => ({
  updateColly: (...a: unknown[]) => updateColly(...(a as [])),
  updatePengiriman: (...a: unknown[]) => updatePengiriman(...(a as [])),
  updateTanggalPengiriman: (...a: unknown[]) => updateTanggalPengiriman(...(a as [])),
}))

beforeEach(() => {
  updateColly.mockReset().mockResolvedValue({})
  updatePengiriman.mockReset().mockResolvedValue({})
  updateTanggalPengiriman.mockReset().mockResolvedValue({})
})

describe('resync when the server value changes underneath the editor', () => {
  it('CollyEditor shows the new server value after a realtime refresh, not the stale local one', () => {
    const { rerender } = render(<CollyEditor pesananId="p1" initialValue={2} />)
    expect(screen.getByLabelText('Colly')).toHaveValue(2)

    rerender(<CollyEditor pesananId="p1" initialValue={3} />)
    expect(screen.getByLabelText('Colly')).toHaveValue(3)
  })

  it('CollyEditor does not write the stale value back on a later blur', async () => {
    const { rerender } = render(<CollyEditor pesananId="p1" initialValue={2} />)
    rerender(<CollyEditor pesananId="p1" initialValue={3} />)

    screen.getByLabelText('Colly').dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await Promise.resolve()

    expect(updateColly).not.toHaveBeenCalled()
  })

  it('PengirimanEditor shows the new server value after a realtime refresh, not the stale local one', () => {
    const { rerender } = render(<PengirimanEditor pesananId="p1" initialValue="Expedisi Jaya" />)
    expect(screen.getByLabelText('Pengiriman')).toHaveValue('Expedisi Jaya')

    rerender(<PengirimanEditor pesananId="p1" initialValue="JNE" />)
    expect(screen.getByLabelText('Pengiriman')).toHaveValue('JNE')
  })

  it('PengirimanEditor does not write the stale value back on a later blur', async () => {
    const { rerender } = render(<PengirimanEditor pesananId="p1" initialValue="Expedisi Jaya" />)
    rerender(<PengirimanEditor pesananId="p1" initialValue="JNE" />)

    screen.getByLabelText('Pengiriman').dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await Promise.resolve()

    expect(updatePengiriman).not.toHaveBeenCalled()
  })

  it('TanggalPengirimanEditor shows the new server value after a realtime refresh, not the stale local one', () => {
    const { rerender } = render(<TanggalPengirimanEditor pesananId="p1" initialValue="2026-08-01" />)
    expect(screen.getByLabelText('Tanggal pengiriman')).toHaveValue('2026-08-01')

    rerender(<TanggalPengirimanEditor pesananId="p1" initialValue="2026-08-02" />)
    expect(screen.getByLabelText('Tanggal pengiriman')).toHaveValue('2026-08-02')
  })

  it('TanggalPengirimanEditor does not write the stale value back on a later blur', async () => {
    const { rerender } = render(<TanggalPengirimanEditor pesananId="p1" initialValue="2026-08-01" />)
    rerender(<TanggalPengirimanEditor pesananId="p1" initialValue="2026-08-02" />)

    screen.getByLabelText('Tanggal pengiriman').dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await Promise.resolve()

    expect(updateTanggalPengiriman).not.toHaveBeenCalled()
  })
})
