'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toggleAktifProduk } from '@/app/(app)/produk/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatRupiah } from '@/lib/utils'
import type { Produk } from '@/lib/types'
import Link from 'next/link'

interface ProdukListProps {
  produkList: Produk[]
  isOwner: boolean
}

export function ProdukList({ produkList, isOwner }: ProdukListProps) {
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'semua' | 'aktif' | 'nonaktif'>('semua')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return produkList.filter((p) => {
      if (status === 'aktif' && !p.aktif) return false
      if (status === 'nonaktif' && p.aktif) return false
      if (!q) return true
      return (
        p.nama.toLowerCase().includes(q) ||
        (p.deskripsi ?? '').toLowerCase().includes(q)
      )
    })
  }, [produkList, query, status])

  async function handleToggleAktif(produk: Produk) {
    setError(null)
    const result = await toggleAktifProduk(produk.id, produk.aktif)
    if (result?.error) {
      setError(result.error)
    }
  }

  if (produkList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada produk.</p>
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau deskripsi produk..."
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'semua' | 'aktif' | 'nonaktif')}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="semua">Semua status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">
          Tidak ada produk yang cocok. Coba kata kunci lain atau ubah filter.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nama</th>
                <th className="text-left px-4 py-3 font-medium">Satuan</th>
                <th className="text-right px-4 py-3 font-medium">Harga Dasar</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                {isOwner && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((produk) => (
                <tr key={produk.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{produk.nama}</p>
                    {produk.deskripsi && (
                      <p className="text-muted-foreground text-xs">{produk.deskripsi}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{produk.satuan}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatRupiah(produk.harga_dasar)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={produk.aktif ? 'default' : 'secondary'}>
                      {produk.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/produk/${produk.id}/edit`}>
                          <Button variant="outline" size="sm">Edit</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleToggleAktif(produk)}
                        >
                          {produk.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
