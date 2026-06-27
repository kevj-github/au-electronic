'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Printer, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatWhatsapp } from '@/components/invoice/whatsapp'
import type { InvoiceData } from '@/lib/invoice-data'

interface DocumentButtonsProps {
  data: InvoiceData
}

async function loadImageBase64(path: string): Promise<string | undefined> {
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

export function DocumentButtons({ data }: DocumentButtonsProps) {
  const [copying, setCopying] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePrint() {
    setError(null)
    const newWindow = window.open('', '_blank')
    if (!newWindow) {
      setError('Popup diblokir. Izinkan popup untuk situs ini.')
      return
    }
    setPdfLoading(true)
    try {
      const [{ DocumentPDF }, crownSrc, watermarkSrc] = await Promise.all([
        import('@/components/invoice/DocumentPDF'),
        loadImageBase64('/au-crown.png'),
        loadImageBase64('/au-trademark.png'),
      ])
      const blob = await pdf(<DocumentPDF data={data} crownSrc={crownSrc} watermarkSrc={watermarkSrc} />).toBlob()
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
      const text = formatWhatsapp(data)
      await navigator.clipboard.writeText(text)
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
