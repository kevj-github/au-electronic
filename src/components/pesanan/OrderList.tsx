'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { DeletePesananButton } from './DeletePesananButton'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import type { Pesanan, ItemPesanan, Pembayaran, StatusPesanan } from '@/lib/types'

export type PesananWithRelations = Pesanan & {
  items: Array<Partial<Pick<ItemPesanan, 'subtotal'>> & Pick<ItemPesanan, 'diambil_oleh_helper'>>
  pembayaran?: Pick<Pembayaran, 'jumlah'>[]
  tanggal_pengiriman: string | null
}

interface OrderListProps {
  pesananList: PesananWithRelations[]
  isOwner: boolean
}

const statusOptions: Array<{ value: StatusPesanan | 'semua'; label: string }> = [
  { value: 'semua', label: 'Semua status' },
  { value: 'diproses', label: 'Diproses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'dibatalkan', label: 'Dibatalkan' },
]

const PAGE_SIZE = 10

export function OrderList({ pesananList, isOwner }: OrderListProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusPesanan | 'semua'>('semua')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pesananList.filter((p) => {
      if (status !== 'semua' && p.status !== status) return false
      if (dateFrom || dateTo) {
        const created = parseISO(p.created_at)
        if (dateFrom && created < startOfDay(parseISO(dateFrom))) return false
        if (dateTo && created > endOfDay(parseISO(dateTo))) return false
      }
      if (!q) return true
      const nama = p.pelanggan?.nama ?? p.nama_pelanggan ?? ''
      return (
        p.kode_pesanan.toLowerCase().includes(q) ||
        nama.toLowerCase().includes(q)
      )
    })
  }, [pesananList, query, status, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => {
    setPage(1)
  }, [query, status, dateFrom, dateTo])
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (pesananList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pesanan.</p>
  }

  return (
    <div className="space-y-3">
      {isOwner && (
        <>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari kode pesanan atau nama pelanggan..."
                className="pl-9"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusPesanan | 'semua')}
              className="border rounded-md px-3 py-2 text-sm"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Tanggal:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-sm"
              aria-label="Dari tanggal"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-36 text-sm"
              aria-label="Sampai tanggal"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset
              </button>
            )}
          </div>
        </>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">
          Tidak ada pesanan yang cocok. Coba kata kunci lain atau ubah filter.
        </p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {paged.map((p) => {
              const diambilCount = p.items.filter((i) => i.diambil_oleh_helper).length
              const totalPesanan = isOwner ? p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0) : 0
              const totalDibayar = isOwner ? (p.pembayaran ?? []).reduce((s, pm) => s + pm.jumlah, 0) : 0
              const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)

              return (
                <div key={p.id} className="border rounded-lg p-3 flex gap-2 items-start hover:bg-gray-50">
                  <Link href={`/pesanan/${p.id}`} className="flex-1 min-w-0 block">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono text-sm text-primary">{p.kode_pesanan}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-sm mt-1">{p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}</p>
                    <div className="flex justify-between items-center mt-2 text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                      </span>
                      {isOwner ? (
                        <span className="font-mono font-medium">
                          {totalPesanan === 0 && (p.pembayaran ?? []).length === 0 ? (
                            <span className="text-muted-foreground font-normal text-xs">Belum ada harga</span>
                          ) : sisaTagihan > 0 ? formatRupiah(sisaTagihan) : (
                            <span className="text-green-600">Lunas</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {diambilCount}/{p.items.length} diambil
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Pengiriman:</span>{' '}
                      {p.tanggal_pengiriman
                        ? format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', { locale: idLocale })
                        : 'Belum ditentukan'}
                    </p>
                  </Link>
                  {isOwner && <DeletePesananButton pesananId={p.id} />}
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kode</th>
                  <th className="text-left px-4 py-3 font-medium">Pelanggan</th>
                  <th className="text-left px-4 py-3 font-medium">Tgl. Pesanan</th>
                  <th className="text-left px-4 py-3 font-medium">Tgl. Pengiriman</th>
                  {isOwner ? (
                    <>
                      <th className="text-right px-4 py-3 font-medium">Total</th>
                      <th className="text-right px-4 py-3 font-medium">Sisa</th>
                    </>
                  ) : (
                    <th className="text-right px-4 py-3 font-medium">Diambil</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  {isOwner && <th className="px-4 py-3 w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((p) => {
                  const diambilCount = p.items.filter((i) => i.diambil_oleh_helper).length
                  const totalPesanan = isOwner ? p.items.reduce((s, i) => s + (i.subtotal ?? 0), 0) : 0
                  const totalDibayar = isOwner ? (p.pembayaran ?? []).reduce((s, pm) => s + pm.jumlah, 0) : 0
                  const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)

                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/pesanan/${p.id}`}
                          className="font-mono text-blue-600 hover:underline"
                        >
                          {p.kode_pesanan}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.tanggal_pengiriman
                          ? format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', { locale: idLocale })
                          : <span className="text-xs italic">Belum ditentukan</span>}
                      </td>
                      {isOwner ? (
                        <>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatRupiah(totalPesanan)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {totalPesanan === 0 && (p.pembayaran ?? []).length === 0 ? (
                              <span className="text-muted-foreground font-normal text-xs">Belum ada harga</span>
                            ) : sisaTagihan > 0 ? (
                              formatRupiah(sisaTagihan)
                            ) : (
                              <span className="text-green-600 font-medium">Lunas</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {diambilCount}/{p.items.length}
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
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
