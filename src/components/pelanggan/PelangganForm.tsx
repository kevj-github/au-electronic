'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertPelanggan } from '@/app/(app)/pelanggan/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
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
        {namaError && <p className="text-sm text-red-500">{namaError}</p>}
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
        <select
          id="tipe"
          name="tipe"
          defaultValue={pelanggan?.tipe ?? 'retail'}
          className="w-full border rounded-md px-3 py-2 text-sm"
        >
          <option value="retail">Retail (B2B)</option>
          <option value="grosir">Grosir (B2C)</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
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
