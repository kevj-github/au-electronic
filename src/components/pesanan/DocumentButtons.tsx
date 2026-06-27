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

// Loads the logo image and crops off the bottom address lines (bottom ~43% of the image).
async function loadLogoBase64(): Promise<string | undefined> {
  try {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('load failed'))
      img.src = '/au-logo.jpg'
    })
    const cropH = Math.floor(img.naturalHeight * 0.57)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = cropH
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}

async function loadWatermarkBase64(): Promise<string | undefined> {
  try {
    const resp = await fetch('/au-trademark.jpg')
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
      const [{ DocumentPDF }, logoSrc, watermarkSrc] = await Promise.all([
        import('@/components/invoice/DocumentPDF'),
        loadLogoBase64(),
        loadWatermarkBase64(),
      ])
      const blob = await pdf(<DocumentPDF data={data} logoSrc={logoSrc} watermarkSrc={watermarkSrc} />).toBlob()
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
