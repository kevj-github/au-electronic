'use client'

import { useState } from 'react'
import { Printer, Save, Search } from 'lucide-react'
import { updateEpsonPrinterName } from '@/app/(app)/pengaturan/actions'
import { connectQz } from '@/lib/qz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EpsonPrinterSettingProps {
  name: string
}

export function EpsonPrinterSetting({ name: initialName }: EpsonPrinterSettingProps) {
  const [name, setName] = useState(initialName)
  const [printers, setPrinters] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDetect() {
    setError(null)
    setStatus(null)
    setDetecting(true)
    try {
      const qz = await connectQz()
      const found = await qz.printers.find()
      setPrinters(Array.isArray(found) ? found : [found])
    } catch {
      setError('QZ Tray tidak berjalan. Jalankan QZ Tray di PC lalu coba lagi.')
    } finally {
      setDetecting(false)
    }
  }

  async function handleSave() {
    setError(null)
    setStatus(null)
    setSaving(true)
    const result = await updateEpsonPrinterName(name)
    if (result?.error) setError(result.error)
    else setStatus('Tersimpan.')
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Printer Epson (Cetak Epson)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nama printer LX-310 di komputer ini. Gunakan Deteksi untuk memilih dari daftar.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="EPSON LX-310"
          className="max-w-xs"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleDetect} disabled={detecting}>
          <Search className="size-4 mr-1.5" />
          {detecting ? 'Mendeteksi...' : 'Deteksi Printer'}
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="size-4 mr-1.5" />
          {saving ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
      {printers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {printers.map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === name ? 'default' : 'outline'}
              size="sm"
              onClick={() => setName(p)}
              title={p}
              className="max-w-full truncate"
            >
              <Printer className="size-4 mr-1.5" />
              {p}
            </Button>
          ))}
        </div>
      )}
      {status && <p className="text-xs text-green-600">{status}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
