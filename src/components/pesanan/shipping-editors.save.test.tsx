import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollyEditor } from './CollyEditor'
import { PengirimanEditor } from './PengirimanEditor'
import { TanggalPengirimanEditor } from './TanggalPengirimanEditor'

/**
 * Covers the actual save-on-blur behavior of the three shipping editors:
 * parsing/normalization, the unchanged-value no-op guard, and (for
 * CollyEditor, the only one of the three that surfaces one) error display.
 * shipping-editors.stale-value.test.tsx covers the separate resync-on-prop-change
 * concern; this file assumes the prop is stable and exercises handleBlur itself.
 */

const updateColly = vi.fn(async () => ({}) as { error?: string })
const updatePengiriman = vi.fn(async () => ({}) as { error?: string })
const updateTanggalPengiriman = vi.fn(async () => ({}) as { error?: string })

vi.mock('@/app/(app)/pesanan/order-lifecycle-actions', () => ({
  updateColly: (...a: unknown[]) => updateColly(...(a as [])),
  updatePengiriman: (...a: unknown[]) => updatePengiriman(...(a as [])),
  updateTanggalPengiriman: (...a: unknown[]) => updateTanggalPengiriman(...(a as [])),
}))

beforeEach(() => {
  updateColly.mockReset().mockResolvedValue({})
  updatePengiriman.mockReset().mockResolvedValue({})
  updateTanggalPengiriman.mockReset().mockResolvedValue({})
})

describe('CollyEditor blur save', () => {
  it('parses digits and saves the number', async () => {
    render(<CollyEditor pesananId="p1" initialValue={null} />)
    const input = screen.getByLabelText('Colly')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updateColly).toHaveBeenCalledWith('p1', 5)
  })

  it('normalises a non-numeric value to blank and saves null', async () => {
    render(<CollyEditor pesananId="p1" initialValue={3} />)
    const input = screen.getByLabelText('Colly')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(input).toHaveValue(null)
    expect(updateColly).toHaveBeenCalledWith('p1', null)
  })

  it('normalises a zero/negative value to blank and saves null', async () => {
    render(<CollyEditor pesananId="p1" initialValue={3} />)
    const input = screen.getByLabelText('Colly')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updateColly).toHaveBeenCalledWith('p1', null)
  })

  it('does not call the action when the parsed value matches initialValue', async () => {
    render(<CollyEditor pesananId="p1" initialValue={5} />)
    const input = screen.getByLabelText('Colly')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updateColly).not.toHaveBeenCalled()
  })

  it('surfaces an error message returned by the action', async () => {
    updateColly.mockResolvedValueOnce({ error: 'Gagal menyimpan' })
    render(<CollyEditor pesananId="p1" initialValue={null} />)
    const input = screen.getByLabelText('Colly')
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.blur(input)
    expect(await screen.findByText('Gagal menyimpan')).toBeInTheDocument()
  })
})

describe('PengirimanEditor blur save', () => {
  it('trims and saves the new value', async () => {
    render(<PengirimanEditor pesananId="p1" initialValue={null} />)
    const input = screen.getByLabelText('Pengiriman')
    fireEvent.change(input, { target: { value: '  JNE  ' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updatePengiriman).toHaveBeenCalledWith('p1', 'JNE')
  })

  it('saves null when cleared to blank', async () => {
    render(<PengirimanEditor pesananId="p1" initialValue="JNE" />)
    const input = screen.getByLabelText('Pengiriman')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updatePengiriman).toHaveBeenCalledWith('p1', null)
  })

  it('does not call the action when the value is unchanged', async () => {
    render(<PengirimanEditor pesananId="p1" initialValue="JNE" />)
    const input = screen.getByLabelText('Pengiriman')
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updatePengiriman).not.toHaveBeenCalled()
  })
})

describe('TanggalPengirimanEditor blur save', () => {
  it('saves the new date', async () => {
    render(<TanggalPengirimanEditor pesananId="p1" initialValue={null} />)
    const input = screen.getByLabelText('Tanggal pengiriman')
    fireEvent.change(input, { target: { value: '2026-09-01' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updateTanggalPengiriman).toHaveBeenCalledWith('p1', '2026-09-01')
  })

  it('saves null when cleared', async () => {
    render(<TanggalPengirimanEditor pesananId="p1" initialValue="2026-09-01" />)
    const input = screen.getByLabelText('Tanggal pengiriman')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updateTanggalPengiriman).toHaveBeenCalledWith('p1', null)
  })

  it('does not call the action when the value is unchanged', async () => {
    render(<TanggalPengirimanEditor pesananId="p1" initialValue="2026-09-01" />)
    const input = screen.getByLabelText('Tanggal pengiriman')
    fireEvent.blur(input)
    await Promise.resolve()
    expect(updateTanggalPengiriman).not.toHaveBeenCalled()
  })
})
