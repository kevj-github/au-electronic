'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeletePelangganButton } from './DeletePelangganButton'
import type { Pelanggan } from '@/lib/types'

interface PelangganListRowProps {
  p: Pelanggan
}

function PelangganRowCardImpl({ p }: PelangganListRowProps) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex justify-between items-start">
        <p className="font-medium text-sm">{p.nama}</p>
        <Badge variant={p.tipe === 'grosir' ? 'default' : 'secondary'}>
          {p.tipe === 'grosir' ? 'Grosir' : 'Retail'}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {p.telepon ?? '—'}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <Link href={`/pelanggan/${p.id}`}>
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </Link>
        <DeletePelangganButton pelangganId={p.id} />
      </div>
    </div>
  )
}

export const PelangganRowCard = memo(PelangganRowCardImpl)

function PelangganRowTableRowImpl({ p }: PelangganListRowProps) {
  return (
    <tr className="hover:bg-muted">
      <td className="px-4 py-3 font-medium">{p.nama}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {p.telepon ?? '—'}
      </td>
      <td className="px-4 py-3">
        <Badge variant={p.tipe === 'grosir' ? 'default' : 'secondary'}>
          {p.tipe === 'grosir' ? 'Grosir' : 'Retail'}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link href={`/pelanggan/${p.id}`}>
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
          <DeletePelangganButton pelangganId={p.id} />
        </div>
      </td>
    </tr>
  )
}

export const PelangganRowTableRow = memo(PelangganRowTableRowImpl)
