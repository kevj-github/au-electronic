import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Pelanggan } from '@/lib/types'

interface PelangganListProps {
  pelangganList: Pelanggan[]
  isOwner: boolean
}

export function PelangganList({ pelangganList, isOwner }: PelangganListProps) {
  if (pelangganList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pelanggan.</p>
  }

  return (
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
          {pelangganList.map((p) => (
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
  )
}
