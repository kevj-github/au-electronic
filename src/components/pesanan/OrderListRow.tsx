'use client'

import { memo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatRupiah } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { DeletePesananButton } from './DeletePesananButton'
import type { OrderRow, TagihanState } from './order-row'

/**
 * Renders a TagihanState. Shared so the two layouts cannot disagree — they
 * previously differed by a stray `font-medium`, which only looked the same
 * because the mobile wrapper was already bold.
 */
function TagihanText({ tagihan }: { tagihan: TagihanState }) {
  if (tagihan.kind === 'belum-ada-harga') {
    return (
      <span className="text-muted-foreground font-normal text-xs">
        Belum ada harga
      </span>
    )
  }
  if (tagihan.kind === 'sisa') return <>{formatRupiah(tagihan.amount)}</>
  return <span className="text-green-600 font-medium">Lunas</span>
}

interface OrderListRowProps {
  row: OrderRow
  isOwner: boolean
}

function OrderRowCardImpl({
  row: {
    p,
    view: { diambilCount, totalItems, tagihan },
  },
  isOwner,
}: OrderListRowProps) {
  return (
    <div className="border rounded-lg p-3 flex gap-2 items-start hover:bg-muted">
      <Link href={`/pesanan/${p.id}`} className="flex-1 min-w-0 block">
        <div className="flex justify-between items-start gap-2">
          <span className="font-mono text-sm text-primary">
            {p.kode_pesanan}
          </span>
          <StatusBadge status={p.status} />
        </div>
        <p className="text-sm mt-1">
          {p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}
        </p>
        {p.pelanggan?.alamat && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {p.pelanggan.alamat}
          </p>
        )}
        <div className="flex justify-between items-center mt-2 text-sm">
          <span className="text-muted-foreground">
            {format(new Date(p.created_at), 'd MMM yyyy', {
              locale: idLocale,
            })}
          </span>
          {isOwner ? (
            <span className="font-mono font-medium">
              <TagihanText tagihan={tagihan} />
            </span>
          ) : (
            <span className="text-muted-foreground">
              {diambilCount}/{totalItems} diambil
            </span>
          )}
        </div>
        {isOwner && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">Pengiriman:</span>{' '}
            {p.tanggal_pengiriman
              ? format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', {
                  locale: idLocale,
                })
              : 'Belum ditentukan'}
          </p>
        )}
      </Link>
      {isOwner && <DeletePesananButton pesananId={p.id} />}
    </div>
  )
}

export const OrderRowCard = memo(OrderRowCardImpl)

function OrderRowTableRowImpl({
  row: {
    p,
    view: { diambilCount, totalItems, totalPesanan, tagihan },
  },
  isOwner,
}: OrderListRowProps) {
  return (
    <tr className="hover:bg-muted">
      <td className="px-4 py-3">
        <Link
          href={`/pesanan/${p.id}`}
          className="font-mono text-blue-600 hover:underline"
        >
          {p.kode_pesanan}
        </Link>
      </td>
      <td className="px-4 py-3">
        <span>{p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}</span>
        {p.pelanggan?.alamat && (
          <span className="block text-xs text-muted-foreground">
            {p.pelanggan.alamat}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
      </td>
      {isOwner && (
        <td className="px-4 py-3 text-muted-foreground">
          {p.tanggal_pengiriman ? (
            format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', {
              locale: idLocale,
            })
          ) : (
            <span className="text-xs italic">Belum ditentukan</span>
          )}
        </td>
      )}
      {isOwner ? (
        <>
          <td className="px-4 py-3 text-right font-mono">
            {formatRupiah(totalPesanan)}
          </td>
          <td className="px-4 py-3 text-right font-mono">
            <TagihanText tagihan={tagihan} />
          </td>
        </>
      ) : (
        <td className="px-4 py-3 text-right text-muted-foreground">
          {diambilCount}/{totalItems}
        </td>
      )}
      <td className="px-4 py-3">
        <StatusBadge status={p.status} />
      </td>
      {isOwner && (
        <td className="px-4 py-3 text-right">
          <DeletePesananButton pesananId={p.id} />
        </td>
      )}
    </tr>
  )
}

export const OrderRowTableRow = memo(OrderRowTableRowImpl)
