'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Pelanggan, TipePelanggan } from '@/lib/types'

interface PelangganListProps {
  pelangganList: Pelanggan[]
  isOwner: boolean
}

export function PelangganList({ pelangganList, isOwner }: PelangganListProps) {
  const [query, setQuery] = useState('')
  const [tipe, setTipe] = useState<TipePelanggan | 'semua'>('semua')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pelangganList.filter((p) => {
      if (tipe !== 'semua' && p.tipe !== tipe) return false
      if (!q) return true
      return (
        p.nama.toLowerCase().includes(q) ||
        (p.telepon ?? '').toLowerCase().includes(q) ||
        (p.alamat ?? '').toLowerCase().includes(q)
      )
    })
  }, [pelangganList, query, tipe])

  if (pelangganList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pelanggan.</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, telepon, atau alamat..."
            className="pl-9"
          />
        </div>
        <select
          value={tipe}
          onChange={(e) => setTipe(e.target.value as TipePelanggan | 'semua')}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="semua">Semua tipe</option>
          <option value="retail">Retail</option>
          <option value="grosir">Grosir</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">
          Tidak ada pelanggan yang cocok. Coba kata kunci lain atau ubah filter.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Nama</th>
                <th className="text-left px-4 py-3 font-medium">Telepon</th>
                <th className="text-left px-4 py-3 font-medium">Tipe</th>
                {isOwner && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.nama}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.telepon ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.tipe === 'grosir' ? 'default' : 'secondary'}>
                      {p.tipe === 'grosir' ? 'Grosir' : 'Retail'}
                    </Badge>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-right">
                      <Link href={`/pelanggan/${p.id}`}>
                        <Button variant="outline" size="sm">Edit</Button>
                      </Link>
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
