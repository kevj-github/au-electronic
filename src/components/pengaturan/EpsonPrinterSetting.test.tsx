import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EpsonPrinterSetting } from './EpsonPrinterSetting'
import { updateEpsonPrinterName } from '@/app/(app)/pengaturan/actions'
import { connectQz } from '@/lib/qz'

vi.mock('@/app/(app)/pengaturan/actions', () => ({
  updateEpsonPrinterName: vi.fn(),
}))
vi.mock('@/lib/qz', () => ({
  connectQz: vi.fn(),
}))

const mockUpdate = vi.mocked(updateEpsonPrinterName)
const mockConnectQz = vi.mocked(connectQz)

beforeEach(() => {
  mockUpdate.mockReset()
  mockConnectQz.mockReset()
})

describe('EpsonPrinterSetting', () => {
  it('renders the initial printer name', () => {
    render(<EpsonPrinterSetting name="EPSON LX-310" />)
    expect(screen.getByRole('textbox')).toHaveValue('EPSON LX-310')
  })

  it('shows "Tersimpan." after a successful save', async () => {
    mockUpdate.mockResolvedValue({})
    const user = userEvent.setup()
    render(<EpsonPrinterSetting name="EPSON LX-310" />)

    await user.click(screen.getByRole('button', { name: /Simpan/ }))

    expect(await screen.findByText('Tersimpan.')).toBeInTheDocument()
    expect(mockUpdate).toHaveBeenCalledWith('EPSON LX-310')
  })

  it('clears a prior "Tersimpan." message when the name is edited afterwards', async () => {
    mockUpdate.mockResolvedValue({})
    const user = userEvent.setup()
    render(<EpsonPrinterSetting name="EPSON LX-310" />)

    await user.click(screen.getByRole('button', { name: /Simpan/ }))
    expect(await screen.findByText('Tersimpan.')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox'), '-2')

    expect(screen.queryByText('Tersimpan.')).not.toBeInTheDocument()
  })

  it('clears a prior save error when the name is edited afterwards', async () => {
    mockUpdate.mockResolvedValue({ error: 'Gagal menyimpan.' })
    const user = userEvent.setup()
    render(<EpsonPrinterSetting name="EPSON LX-310" />)

    await user.click(screen.getByRole('button', { name: /Simpan/ }))
    expect(await screen.findByText('Gagal menyimpan.')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox'), '-2')

    expect(screen.queryByText('Gagal menyimpan.')).not.toBeInTheDocument()
  })

  it('clears a prior "Tersimpan." message when a detected printer is picked instead', async () => {
    mockUpdate.mockResolvedValue({})
    mockConnectQz.mockResolvedValue({
      printers: { find: vi.fn().mockResolvedValue(['EPSON LX-310', 'EPSON TM-T88']) },
    } as unknown as Awaited<ReturnType<typeof connectQz>>)
    const user = userEvent.setup()
    render(<EpsonPrinterSetting name="EPSON LX-310" />)

    await user.click(screen.getByRole('button', { name: /Simpan/ }))
    expect(await screen.findByText('Tersimpan.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Deteksi Printer/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'EPSON TM-T88' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'EPSON TM-T88' }))

    expect(screen.queryByText('Tersimpan.')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('EPSON TM-T88')
  })

  it('disables Simpan while the name is blank', () => {
    render(<EpsonPrinterSetting name="" />)
    expect(screen.getByRole('button', { name: /Simpan/ })).toBeDisabled()
  })

  it('shows a QZ-not-running error when detection fails', async () => {
    mockConnectQz.mockRejectedValue(new Error('no socket'))
    const user = userEvent.setup()
    render(<EpsonPrinterSetting name="EPSON LX-310" />)

    await user.click(screen.getByRole('button', { name: /Deteksi Printer/ }))

    expect(
      await screen.findByText('QZ Tray tidak berjalan. Jalankan QZ Tray di PC lalu coba lagi.')
    ).toBeInTheDocument()
  })
})
