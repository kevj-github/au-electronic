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
      // Resolve the real component here (not via next/dynamic) — @react-pdf/renderer's
      // pdf() uses its own non-DOM reconciler that doesn't support React.lazy/Suspense,
      // so a next/dynamic-wrapped component renders as empty/broken output.
      const { DocumentPDF } = await import('@/components/invoice/DocumentPDF')
      const blob = await pdf(<DocumentPDF data={data} />).toBlob()
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
