'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { formatRupiah, hitungSaldo } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import type { Pesanan, ItemPesanan, Pembayaran, StatusPesanan } from '@/lib/types'

export type PesananWithRelations = Pesanan & {
  items: Pick<ItemPesanan, 'subtotal'>[]
  pembayaran: Pick<Pembayaran, 'jumlah'>[]
}

interface OrderListProps {
  pesananList: PesananWithRelations[]
}

const statusOptions: Array<{ value: StatusPesanan | 'semua'; label: string }> = [
  { value: 'semua', label: 'Semua status' },
  { value: 'draft', label: 'Draft' },
  { value: 'konfirmasi', label: 'Dikonfirmasi' },
  { value: 'diproses', label: 'Diproses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'dibatalkan', label: 'Dibatalkan' },
]

const PAGE_SIZE = 10

export function OrderList({ pesananList }: OrderListProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusPesanan | 'semua'>('semua')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pesananList.filter((p) => {
      if (status !== 'semua' && p.status !== status) return false
      if (!q) return true
      const nama = p.pelanggan?.nama ?? p.nama_pelanggan ?? ''
      return (
        p.kode_pesanan.toLowerCase().includes(q) ||
        nama.toLowerCase().includes(q)
      )
    })
  }, [pesananList, query, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  useEffect(() => {
    setPage(1)
  }, [query, status])
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (pesananList.length === 0) {
    return <p className="text-muted-foreground text-sm">Belum ada pesanan.</p>
  }

  return (
    <div className="space-y-3">
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

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg p-4">
          Tidak ada pesanan yang cocok. Coba kata kunci lain atau ubah filter.
        </p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {paged.map((p) => {
              const totalPesanan = p.items.reduce((s, i) => s + i.subtotal, 0)
              const totalDibayar = p.pembayaran.reduce((s, pm) => s + pm.jumlah, 0)
              const { sisaTagihan } = hitungSaldo(totalPesanan, totalDibayar)

              return (
                <Link
                  key={p.id}
                  href={`/pesanan/${p.id}`}
                  className="block border rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-sm text-primary">{p.kode_pesanan}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-sm mt-1">{p.pelanggan?.nama ?? p.nama_pelanggan ?? '—'}</p>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-muted-foreground">
                      {format(new Date(p.created_at), 'd MMM yyyy', { locale: idLocale })}
                    </span>
                    <span className="font-mono font-medium">
                      {sisaTagihan > 0 ? formatRupiah(sisaTagihan) : (
                        <span className="text-green-600">Lunas</span>
                      )}
                    </span>
                  </div>
                </Link>
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
                  <th className="text-left px-4 py-3 font-medium">Tanggal</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Sisa</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((p) => {
                  const totalPesanan = p.items.reduce((s, i) => s + i.subtotal, 0)
                  const totalDibayar = p.pembayaran.reduce((s, pm) => s + pm.jumlah, 0)
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
                      <td className="px-4 py-3 text-right font-mono">
                        {formatRupiah(totalPesanan)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {sisaTagihan > 0 ? (
                          formatRupiah(sisaTagihan)
                        ) : (
                          <span className="text-green-600 font-medium">Lunas</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
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
