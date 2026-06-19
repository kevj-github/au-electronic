'use client'

import { toggleAktifProduk } from '@/app/(app)/produk/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRupiah } from '@/lib/utils'
import type { Produk } from '@/lib/types'
import Link from 'next/link'

interface ProdukListProps {
  produkList: Produk[]
  isOwner: boolean
}

export function ProdukList({ produkList, isOwner }: ProdukListProps) {
  if (produkList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada produk.</p>
  }

  return (
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
          {produkList.map((produk) => (
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
                    <form
                      action={async () => {
                        await toggleAktifProduk(produk.id, produk.aktif)
                      }}
                    >
                      <Button variant="ghost" size="sm" type="submit">
                        {produk.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </form>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
