'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { upsertProduk } from '@/app/(app)/produk/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Produk } from '@/lib/types'

interface ProdukFormProps {
  produk?: Produk
}

export function ProdukForm({ produk }: ProdukFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await upsertProduk(new FormData(e.currentTarget))
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      {produk && <input type="hidden" name="id" value={produk.id} />}
      <div className="space-y-2">
        <Label htmlFor="nama">Nama Produk</Label>
        <Input id="nama" name="nama" defaultValue={produk?.nama} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="deskripsi">Deskripsi</Label>
        <Input id="deskripsi" name="deskripsi" defaultValue={produk?.deskripsi ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="satuan">Satuan</Label>
          <Input id="satuan" name="satuan" defaultValue={produk?.satuan ?? 'pcs'} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="harga_dasar">Harga Dasar (Rp)</Label>
          <Input
            id="harga_dasar"
            name="harga_dasar"
            type="number"
            min="0"
            defaultValue={produk?.harga_dasar ?? 0}
            required
          />
        </div>
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
