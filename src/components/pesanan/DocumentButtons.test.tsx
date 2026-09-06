import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DocumentButtons } from './DocumentButtons'
import type { InvoiceData } from '@/lib/invoice-data'

/**
 * `DocumentButtons` had zero test coverage despite driving four distinct async
 * flows: PDF generation (desktop preview-in-tab vs. mobile download), the
 * ESC/P Epson print path via QZ Tray, and the WhatsApp clipboard copy (which
 * itself branches on ClipboardItem availability). All of it depends on
 * dynamic imports (`@react-pdf/renderer`, `DocumentPDF`, `escp`, `qz`) and
 * browser APIs (`window.open`, `navigator.clipboard`, `URL.createObjectURL`)
 * that don't exist by default in jsdom, hence the mocking below.
 *
 * `vi.hoisted` is used (rather than closing over module-scope `const`s from
 * inside `vi.mock` factories) because this file statically imports the
 * component under test — unlike the `await import('./actions')`-per-test
 * pattern elsewhere, there's no point after which module-scope consts are
 * guaranteed to exist before the mocked modules are first evaluated.
 */

const mocks = vi.hoisted(() => ({
  getInvoiceData: vi.fn(),
  getEpsonPrinterName: vi.fn(),
  buildFilename: vi.fn(() => 'invoice.pdf'),
  errorMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
  loadImageBase64: vi.fn(async () => 'data:image/png;base64,xxx'),
  formatWhatsapp: vi.fn(() => 'WA-TEXT'),
  pdf: vi.fn(),
  buildEscP: vi.fn(() => 'ESC/P-DATA'),
  connectQz: vi.fn(),
}))

vi.mock('@/app/(app)/pesanan/order-lifecycle-actions', () => ({
  getInvoiceData: mocks.getInvoiceData,
}))
vi.mock('@/app/(app)/pengaturan/actions', () => ({
  getEpsonPrinterName: mocks.getEpsonPrinterName,
}))
vi.mock('@/lib/document-export', () => ({
  buildFilename: mocks.buildFilename,
  errorMessage: mocks.errorMessage,
  loadImageBase64: mocks.loadImageBase64,
}))
vi.mock('@/components/invoice/whatsapp', () => ({
  formatWhatsapp: mocks.formatWhatsapp,
}))
vi.mock('@react-pdf/renderer', () => ({ pdf: mocks.pdf }))
vi.mock('@/components/invoice/DocumentPDF', () => ({ DocumentPDF: () => null }))
vi.mock('@/lib/escp', () => ({ buildEscP: mocks.buildEscP }))
vi.mock('@/lib/qz', () => ({ connectQz: mocks.connectQz }))

const baseData: InvoiceData = {
  kodePesanan: 'PSN-1',
  tanggal: '2026-09-01T00:00:00.000Z',
  namaPelanggan: 'Budi',
  items: [{ namaBarang: 'Kabel', qty: 2, hargaSatuan: 5000, subtotal: 10000 }],
  totalPesanan: 10000,
  totalDibayar: 10000,
  sisaTagihan: 0,
  catatan: null,
}

function renderButtons(props: Partial<Parameters<typeof DocumentButtons>[0]> = {}) {
  render(<DocumentButtons pesananId="p1" data={baseData} belumDicekCount={0} {...props} />)
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'

function fakeWindow() {
  return { location: { href: '' }, close: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  setUserAgent(DESKTOP_UA)
  vi.spyOn(window, 'open').mockReturnValue(fakeWindow() as unknown as Window)
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
  mocks.getInvoiceData.mockResolvedValue({ data: baseData })
  mocks.pdf.mockReturnValue({ toBlob: vi.fn(async () => new Blob(['pdf'])) })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/**
 * `userEvent.setup()` itself installs its own `navigator.clipboard` stub
 * (`Clipboard.attachClipboardStubToView`, unconditional on every `setup()`
 * call, independent of the `writeToClipboard` option). Defining our own mock
 * clipboard *before* calling `userEvent.setup()` gets silently clobbered by
 * that stub, so this must run after `userEvent.setup()`, not in `beforeEach`.
 */
function mockClipboard() {
  const write = vi.fn().mockResolvedValue(undefined)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { write, writeText }, configurable: true })
  return { write, writeText }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('warning banners', () => {
  it('shows a warning when an item has no price yet', () => {
    renderButtons({ data: { ...baseData, items: [{ ...baseData.items[0], hargaSatuan: 0 }] } })
    expect(screen.getByText(/harga satuannya belum diisi/)).toBeInTheDocument()
  })

  it('shows a warning for unchecked items', () => {
    renderButtons({ belumDicekCount: 3 })
    expect(screen.getByText('3 item belum dicek.')).toBeInTheDocument()
  })

  it('shows neither warning when priced and fully checked', () => {
    renderButtons()
    expect(screen.queryByText(/belum diisi/)).not.toBeInTheDocument()
    expect(screen.queryByText(/belum dicek/)).not.toBeInTheDocument()
  })
})

describe('handleCopyWhatsapp', () => {
  it('uses the ClipboardItem path with fresh data when available', async () => {
    // @ts-expect-error test-only global, not in the jsdom lib
    global.ClipboardItem = class {
      items: unknown
      constructor(items: unknown) {
        this.items = items
      }
    }
    const user = userEvent.setup()
    const { write } = mockClipboard()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Copy WhatsApp/ }))

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    expect(mocks.getInvoiceData).toHaveBeenCalledWith('p1')
    expect(screen.getByText('Disalin!')).toBeInTheDocument()
  })

  it('falls back to writeText with the prop data when ClipboardItem is unavailable', async () => {
    // @ts-expect-error simulating an environment without ClipboardItem
    global.ClipboardItem = undefined
    const user = userEvent.setup()
    const { writeText } = mockClipboard()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Copy WhatsApp/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('WA-TEXT'))
    expect(mocks.getInvoiceData).not.toHaveBeenCalled()
  })

  it('shows an error and resets copying state when the clipboard write fails', async () => {
    // @ts-expect-error simulating an environment without ClipboardItem
    global.ClipboardItem = undefined
    const user = userEvent.setup()
    const { writeText } = mockClipboard()
    writeText.mockRejectedValue(new Error('denied'))
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Copy WhatsApp/ }))

    await waitFor(() => expect(screen.getByText('Gagal menyalin ke clipboard.')).toBeInTheDocument())
    expect(screen.queryByText('Disalin!')).not.toBeInTheDocument()
  })
})

describe('handlePrint (desktop)', () => {
  it('opens a tab synchronously and navigates it to the generated PDF', async () => {
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak PDF/ }))

    expect(window.open).toHaveBeenCalledWith('', '_blank')
    await waitFor(() => expect(win.location.href).toBe('blob:mock-url'))
  })

  it('shows a popup-blocked error and never generates a PDF when window.open fails', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak PDF/ }))

    expect(screen.getByText('Popup diblokir. Izinkan popup untuk situs ini.')).toBeInTheDocument()
    expect(mocks.pdf).not.toHaveBeenCalled()
  })

  it('closes the tab and shows an error when PDF generation fails', async () => {
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    mocks.pdf.mockReturnValue({ toBlob: vi.fn(async () => { throw new Error('boom') }) })
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak PDF/ }))

    await waitFor(() => expect(win.close).toHaveBeenCalled())
    expect(screen.getByText('Gagal membuat PDF.')).toBeInTheDocument()
  })
})

describe('handlePrint (mobile)', () => {
  it('downloads the PDF via a named anchor instead of opening a tab', async () => {
    setUserAgent(MOBILE_UA)
    const openSpy = vi.spyOn(window, 'open')
    let capturedHref = ''
    let capturedDownload = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      capturedHref = this.href
      capturedDownload = this.download
    })
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak PDF/ }))

    await waitFor(() => expect(capturedDownload).toBe('invoice.pdf'))
    expect(capturedHref).toContain('blob:mock-url')
    expect(openSpy).not.toHaveBeenCalled()
  })
})

describe('handlePreview', () => {
  it('opens a tab and navigates it to the generated PDF', async () => {
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: 'Preview' }))

    await waitFor(() => expect(win.location.href).toBe('blob:mock-url'))
  })

  it('shows a popup-blocked error when window.open fails', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: 'Preview' }))

    expect(screen.getByText('Popup diblokir. Izinkan popup untuk situs ini.')).toBeInTheDocument()
  })

  it('closes the tab and shows an error when PDF generation fails', async () => {
    const win = fakeWindow()
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window)
    mocks.pdf.mockReturnValue({ toBlob: vi.fn(async () => { throw new Error('boom') }) })
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: 'Preview' }))

    await waitFor(() => expect(win.close).toHaveBeenCalled())
    expect(screen.getByText('Gagal membuat PDF.')).toBeInTheDocument()
  })
})

describe('handleEpsonPrint', () => {
  it('shows an error when the printer name cannot be read', async () => {
    mocks.getEpsonPrinterName.mockResolvedValue({ name: '', error: 'timeout' })
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak Epson/ }))

    await waitFor(() =>
      expect(screen.getByText('Gagal membaca nama printer Epson: timeout')).toBeInTheDocument()
    )
    expect(mocks.connectQz).not.toHaveBeenCalled()
  })

  it('prompts to configure a printer name when none is saved', async () => {
    mocks.getEpsonPrinterName.mockResolvedValue({ name: '' })
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak Epson/ }))

    await waitFor(() =>
      expect(
        screen.getByText('Atur nama printer Epson di Pengaturan terlebih dahulu.')
      ).toBeInTheDocument()
    )
    expect(mocks.connectQz).not.toHaveBeenCalled()
  })

  it('surfaces a QZ Tray connection failure', async () => {
    mocks.getEpsonPrinterName.mockResolvedValue({ name: 'EPSON LX-310' })
    mocks.connectQz.mockRejectedValue(new Error('socket closed'))
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak Epson/ }))

    await waitFor(() =>
      expect(
        screen.getByText('QZ Tray tidak berjalan. Jalankan QZ Tray di PC. (socket closed)')
      ).toBeInTheDocument()
    )
  })

  it('surfaces an error when the print call itself fails', async () => {
    mocks.getEpsonPrinterName.mockResolvedValue({ name: 'EPSON LX-310' })
    mocks.connectQz.mockResolvedValue({
      configs: { create: vi.fn(() => 'CFG') },
      print: vi.fn().mockRejectedValue(new Error('printer offline')),
    })
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak Epson/ }))

    await waitFor(() =>
      expect(screen.getByText('Gagal mencetak ke Epson: printer offline')).toBeInTheDocument()
    )
  })

  it('builds the ESC/P receipt and sends it raw to the saved printer', async () => {
    mocks.getEpsonPrinterName.mockResolvedValue({ name: 'EPSON LX-310' })
    const print = vi.fn().mockResolvedValue(undefined)
    const create = vi.fn(() => 'CFG')
    mocks.connectQz.mockResolvedValue({ configs: { create }, print })
    const user = userEvent.setup()
    renderButtons()

    await user.click(screen.getByRole('button', { name: /Cetak Epson/ }))

    await waitFor(() => expect(print).toHaveBeenCalled())
    expect(create).toHaveBeenCalledWith('EPSON LX-310')
    expect(print).toHaveBeenCalledWith('CFG', [
      { type: 'raw', format: 'command', flavor: 'plain', data: 'ESC/P-DATA' },
    ])
  })
})
