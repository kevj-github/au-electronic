'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { formatWhatsapp } from '@/components/invoice/whatsapp'
import type { InvoiceData } from '@/lib/invoice-data'

// Lazy-load PDF components to avoid SSR issues
const InvoicePDF = dynamic(
  () => import('@/components/invoice/InvoicePDF').then((m) => m.InvoicePDF),
  { ssr: false }
)
const NotaPDF = dynamic(
  () => import('@/components/invoice/NotaPDF').then((m) => m.NotaPDF),
  { ssr: false }
)

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
      const Component = data.tipeDokumen === 'invoice' ? InvoicePDF : NotaPDF
      const blob = await pdf(<Component data={data} />).toBlob()
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
          {pdfLoading ? 'Memuat...' : data.tipeDokumen === 'invoice' ? '🖨 Cetak Invoice' : '🖨 Cetak Nota'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyWhatsapp}>
          {copying ? '✓ Disalin!' : '📋 Copy WhatsApp'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  )
}
