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

  async function handlePrint() {
    setPdfLoading(true)
    try {
      const Component = data.tipeDokumen === 'invoice' ? InvoicePDF : NotaPDF
      const blob = await pdf(<Component data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleCopyWhatsapp() {
    setCopying(true)
    try {
      const text = formatWhatsapp(data)
      await navigator.clipboard.writeText(text)
      setTimeout(() => setCopying(false), 2000)
    } catch {
      setCopying(false)
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint} disabled={pdfLoading}>
        {pdfLoading ? 'Memuat...' : data.tipeDokumen === 'invoice' ? '🖨 Cetak Invoice' : '🖨 Cetak Nota'}
      </Button>
      <Button variant="outline" size="sm" onClick={handleCopyWhatsapp}>
        {copying ? '✓ Disalin!' : '📋 Copy WhatsApp'}
      </Button>
    </div>
  )
}
