'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Printer, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhatsapp } from '@/components/invoice/whatsapp'
import { getInvoiceData } from '@/app/(app)/pesanan/actions'
import type { InvoiceData } from '@/lib/invoice-data'

interface DocumentButtonsProps {
  pesananId: string
  data: InvoiceData
}

// Cache the base64-encoded logo/watermark across clicks — they're static assets,
// so only the first print pays the fetch+encode cost.
const imageCache = new Map<string, Promise<string | undefined>>()

function loadImageBase64(path: string): Promise<string | undefined> {
  const cached = imageCache.get(path)
  if (cached) return cached
  const promise = fetchImageBase64(path).then((result) => {
    // Don't cache a failed load, so a transient error can be retried next click.
    if (result === undefined) imageCache.delete(path)
    return result
  })
  imageCache.set(path, promise)
  return promise
}

async function fetchImageBase64(path: string): Promise<string | undefined> {
  try {
    const resp = await fetch(path)
    const blob = await resp.blob()
    return new Promise((res) => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export function DocumentButtons({ pesananId, data }: DocumentButtonsProps) {
  const [copying, setCopying] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Always pull the latest saved state at generation time so the document never
  // reflects a stale render-time prop (e.g. a delivery date edited moments ago,
  // where blurring the date input is itself what triggered this click). Fall
  // back to the prop if the refetch fails.
  async function freshData(): Promise<InvoiceData> {
    const result = await getInvoiceData(pesananId)
    return result.data ?? data
  }

  async function handlePrint() {
    setError(null)
    const newWindow = window.open('', '_blank')
    if (!newWindow) {
      setError('Popup diblokir. Izinkan popup untuk situs ini.')
      return
    }
    setPdfLoading(true)
    try {
      const [{ DocumentPDF }, crownSrc, watermarkSrc, latest] = await Promise.all([
        import('@/components/invoice/DocumentPDF'),
        loadImageBase64('/au-crown.png'),
        loadImageBase64('/au-trademark.png'),
        freshData(),
      ])
      const blob = await pdf(<DocumentPDF data={latest} crownSrc={crownSrc} watermarkSrc={watermarkSrc} />).toBlob()
      const url = URL.createObjectURL(blob)
      newWindow.location.href = url
    } catch {
      newWindow.close()
      setError('Gagal membuat PDF.')
    } finally {
      setPdfLoading(false)
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
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={pdfLoading}>
          <Printer className="size-4" />
          {pdfLoading ? 'Memuat...' : 'Cetak PDF'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyWhatsapp}>
          {copying ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copying ? 'Disalin!' : 'Copy WhatsApp'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  )
}
