'use client'

import { useState } from 'react'
import { Printer, Save, Search } from 'lucide-react'
import { updateEpsonPrinterName } from '@/app/(app)/pengaturan/actions'
import { connectQz } from '@/lib/qz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setErrorFromResult } from '@/lib/action-result'
import { usePropSyncedState } from '@/hooks/use-prop-synced-state'

interface EpsonPrinterSettingProps {
  name: string
}

export function EpsonPrinterSetting({ name: initialName }: EpsonPrinterSettingProps) {
  // RealtimeRefresh (mounted on this page for the `users` table) can push a
  // fresh `name` prop from another device's save — resync to it.
  const [name, setName] = usePropSyncedState(initialName, (v) => v)
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
    if (!setErrorFromResult(result, setError)) setStatus('Tersimpan.')
    setSaving(false)
  }

  // A prior "Tersimpan."/error message describes the value at the time it was
  // shown, not whatever the field holds now — drop it the moment the name
  // changes for any reason (typing, or picking a detected printer) so it
  // can't mislead the user into thinking an edited-but-unsaved value was saved.
  function handleNameChange(next: string) {
    setName(next)
    setStatus(null)
    setError(null)
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
          onChange={(e) => handleNameChange(e.target.value)}
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
              onClick={() => handleNameChange(p)}
              title={p}
              className="max-w-full truncate"
            >
              <Printer className="size-4 mr-1.5" />
              {p}
            </Button>
          ))}
        </div>
      )}
      {status && <p className="text-xs text-success">{status}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
