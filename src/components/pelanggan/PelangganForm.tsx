'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertPelanggan } from '@/app/(app)/pelanggan/actions'
import { Button } from '@/components/ui/button'
import { setErrorFromResult } from '@/lib/action-result'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Pelanggan } from '@/lib/types'

interface PelangganFormProps {
  pelanggan?: Pelanggan
}

export function PelangganForm({ pelanggan }: PelangganFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [namaError, setNamaError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (!String(fd.get('nama') ?? '').trim()) {
      setNamaError('Nama pelanggan wajib diisi.')
      return
    }
    setNamaError(null)
    setLoading(true)
    setError(null)
    const result = await upsertPelanggan(fd)
    if (setErrorFromResult(result, setError)) setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {pelanggan && <input type="hidden" name="id" value={pelanggan.id} />}
      <div className="space-y-2">
        <Label htmlFor="nama">Nama Pelanggan</Label>
        <Input
          id="nama"
          name="nama"
          defaultValue={pelanggan?.nama}
          aria-invalid={namaError ? true : undefined}
          onChange={() => namaError && setNamaError(null)}
        />
        {namaError && <p className="text-sm text-destructive">{namaError}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="telepon">Nomor Telepon</Label>
        <Input id="telepon" name="telepon" defaultValue={pelanggan?.telepon ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="alamat">Alamat</Label>
        <Input id="alamat" name="alamat" defaultValue={pelanggan?.alamat ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tipe">Tipe Pelanggan</Label>
        <Select
          name="tipe"
          defaultValue={pelanggan?.tipe ?? 'retail'}
          items={{ retail: 'Retail (B2B)', grosir: 'Grosir (B2C)' }}
        >
          <SelectTrigger id="tipe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="retail">Retail (B2B)</SelectItem>
            <SelectItem value="grosir">Grosir (B2C)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
      </div>
    </form>
  )
}
