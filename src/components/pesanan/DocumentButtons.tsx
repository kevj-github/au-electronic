'use client'

import { useState } from 'react'
import { Printer, Copy, Check, Eye, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhatsapp } from '@/components/invoice/whatsapp'
import { getInvoiceData } from '@/app/(app)/pesanan/order-lifecycle-actions'
import { getEpsonPrinterName } from '@/app/(app)/pengaturan/actions'
import { buildFilename, errorMessage, loadImageBase64 } from '@/lib/document-export'
import type { InvoiceData } from '@/lib/invoice-data'

interface DocumentButtonsProps {
  pesananId: string
  data: InvoiceData
  /**
   * How many items are still unticked in the owner's "Dicek pemilik" column
   * (the leftmost checkbox in the item list). Passed in rather than read from
   * `data`, because InvoiceData is the document payload shared with the PDF and
   * ESC/P renderers — checklist progress is UI state, not invoice content.
   */
  belumDicekCount: number
}

export function DocumentButtons({ pesananId, data, belumDicekCount }: DocumentButtonsProps) {
  const [copying, setCopying] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [epsonLoading, setEpsonLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hargaBelumDiisiCount = data.items.filter((item) => item.hargaSatuan <= 0).length

  // Always pull the latest saved state at generation time so the document never
  // reflects a stale render-time prop (e.g. a delivery date edited moments ago,
  // where blurring the date input is itself what triggered this click). Fall
  // back to the prop if the refetch fails.
  async function freshData(): Promise<InvoiceData> {
    const result = await getInvoiceData(pesananId)
    return result.data ?? data
  }

  // Render the latest data to a PDF blob and return its object URL + filename.
  // Shared by the download (Cetak) and preview flows.
  //
  // `pdf` is imported here rather than at the top of the file: it drags in
  // pdfkit and the yoga-layout WASM shim, ~1.6 MB that made this route's eager
  // bundle five times heavier than any other page in the app. Lazily importing
  // only DocumentPDF achieved nothing while `pdf` itself stayed static, since
  // both live in @react-pdf/renderer. Keep it a plain `await import()` — a
  // next/dynamic wrapper cannot be passed to pdf() (see CLAUDE.md).
  async function generatePdfUrl(): Promise<{ url: string; filename: string }> {
    const [{ pdf }, { DocumentPDF }, crownSrc, watermarkSrc, latest] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/invoice/DocumentPDF'),
      loadImageBase64('/au-crown.png'),
      loadImageBase64('/au-trademark.png'),
      freshData(),
    ])
    const blob = await pdf(<DocumentPDF data={latest} crownSrc={crownSrc} watermarkSrc={watermarkSrc} />).toBlob()
    return { url: URL.createObjectURL(blob), filename: buildFilename(latest) }
  }

  async function handlePrint() {
    setError(null)
    // Desktop previews the PDF inline (and reads the name from embedded metadata),
    // so open a tab synchronously to stay popup-blocker-safe. Mobile browsers
    // download the blob instead of previewing, and name the file from the blob
    // URL's random UUID — so there we trigger a named <a download> instead.
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    const newWindow = isMobile ? null : window.open('', '_blank')
    if (!isMobile && !newWindow) {
      setError('Popup diblokir. Izinkan popup untuk situs ini.')
      return
    }
    setPdfLoading(true)
    try {
      const { url, filename } = await generatePdfUrl()
      if (isMobile) {
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        // Give the browser time to start the download before releasing the blob.
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      } else {
        newWindow!.location.href = url
      }
    } catch {
      newWindow?.close()
      setError('Gagal membuat PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  // Mobile-only: open the PDF inline in a new tab instead of downloading it,
  // so the user can view it before saving. Keeps the popup-blocker-safe pattern
  // (open the tab synchronously, navigate once the blob is ready).
  async function handlePreview() {
    setError(null)
    const newWindow = window.open('', '_blank')
    if (!newWindow) {
      setError('Popup diblokir. Izinkan popup untuk situs ini.')
      return
    }
    setPdfLoading(true)
    try {
      const { url } = await generatePdfUrl()
      newWindow.location.href = url
    } catch {
      newWindow.close()
      setError('Gagal membuat PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  // Print a crisp ESC/P text receipt to the Epson LX-310 via QZ Tray. Separate
  // from the PDF flow: reads the saved printer name, builds raw ESC/P, and sends
  // it RAW so the printer uses its built-in font (no driver rasterization).
  async function handleEpsonPrint() {
    setError(null)
    setEpsonLoading(true)
    try {
      const { name, error: printerNameError } = await getEpsonPrinterName()
      if (printerNameError) {
        setError(`Gagal membaca nama printer Epson: ${printerNameError}`)
        return
      }
      if (!name) {
        setError('Atur nama printer Epson di Pengaturan terlebih dahulu.')
        return
      }
      const [{ buildEscP }, { connectQz }, latest] = await Promise.all([
        import('@/lib/escp'),
        import('@/lib/qz'),
        freshData(),
      ])
      const escp = buildEscP(latest)

      let qz
      try {
        qz = await connectQz()
      } catch (e) {
        console.error('Cetak Epson: gagal terhubung ke QZ Tray', e)
        setError(`QZ Tray tidak berjalan. Jalankan QZ Tray di PC. (${errorMessage(e)})`)
        return
      }

      const config = qz.configs.create(name)
      await qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: escp }])
    } catch (e) {
      // Surface the underlying cause — a printer-name mismatch is the most common
      // QZ failure and the message names the printer QZ could not find.
      console.error('Cetak Epson: gagal mencetak', e)
      setError(`Gagal mencetak ke Epson: ${errorMessage(e)}`)
    } finally {
      setEpsonLoading(false)
    }
  }

  async function handleCopyWhatsapp() {
    setError(null)
    setCopying(true)
    try {
      // iOS Safari drops the clipboard permission if we `await` a refetch before
      // writing. Use the ClipboardItem-with-Promise form, which is allowed to
      // resolve async data while keeping the user-gesture activation. Fall back
      // to a synchronous prop-based write where ClipboardItem is unavailable.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const item = new ClipboardItem({
          'text/plain': freshData().then(
            (d) => new Blob([formatWhatsapp(d)], { type: 'text/plain' })
          ),
        })
        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(formatWhatsapp(data))
      }
      setTimeout(() => setCopying(false), 2000)
    } catch {
      setCopying(false)
      setError('Gagal menyalin ke clipboard.')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {hargaBelumDiisiCount > 0 && (
          <p className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            <AlertTriangle className="size-3.5" />
            Ada {hargaBelumDiisiCount} item yang harga satuannya belum diisi.
          </p>
        )}
        {belumDicekCount > 0 && (
          <p className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
            <AlertTriangle className="size-3.5" />
            {belumDicekCount} item belum dicek.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={pdfLoading}>
          <Printer className="size-4" />
          {pdfLoading ? 'Memuat...' : 'Cetak PDF'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleEpsonPrint} disabled={epsonLoading}>
          <Printer className="size-4" />
          {epsonLoading ? 'Mencetak...' : 'Cetak Epson'}
        </Button>
        {/* Mobile only: preview inline instead of downloading (Cetak downloads on mobile). */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreview}
          disabled={pdfLoading}
          className="sm:hidden"
        >
          <Eye className="size-4" />
          Preview
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyWhatsapp}>
          {copying ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copying ? 'Disalin!' : 'Copy WhatsApp'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  )
}
