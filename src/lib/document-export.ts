import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import type { InvoiceData } from '@/lib/invoice-data'

// Build the download filename: "Nama - Alamat - Tgl Pesanan.pdf", with empty
// fields skipped and filesystem-illegal characters (/ \ ? % * : | " < >)
// replaced by "-". Mobile browsers name the saved file from this, since they
// download the blob instead of reading the PDF's embedded title metadata.
export function buildFilename(data: InvoiceData): string {
  const tanggal = format(new Date(data.tanggal), 'd MMM yyyy', { locale: idLocale })
  const base = [data.namaPelanggan, data.alamatPelanggan, tanggal]
    .filter(Boolean)
    .join(' - ')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()
  return `${base || 'invoice'}.pdf`
}

/** Readable text for whatever QZ Tray threw (it rejects with plain strings too). */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return 'penyebab tidak diketahui'
}

// Cache the base64-encoded logo/watermark across clicks — they're static assets,
// so only the first print pays the fetch+encode cost.
const imageCache = new Map<string, Promise<string | undefined>>()

export function loadImageBase64(path: string): Promise<string | undefined> {
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
