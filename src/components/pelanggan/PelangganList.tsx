'use client'

import { useMemo, useState } from 'react'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterBar } from '@/components/ui/filter-bar'
import { PelangganRowCard, PelangganRowTableRow } from './PelangganListRow'
import { useSearchable } from '@/hooks/use-searchable'
import { usePagedList } from '@/hooks/use-paged-list'
import type { Pelanggan, TipePelanggan } from '@/lib/types'

interface PelangganListProps {
  pelangganList: Pelanggan[]
}

const PAGE_SIZE = 10

const tipeOptions: Array<{ value: TipePelanggan | 'semua'; label: string }> = [
  { value: 'semua', label: 'Semua tipe' },
  { value: 'retail', label: 'Retail' },
  { value: 'grosir', label: 'Grosir' },
]

export function PelangganList({ pelangganList }: PelangganListProps) {
  const [query, setQuery] = useState('')
  const [tipe, setTipe] = useState<TipePelanggan | 'semua'>('semua')

  // NUL separators keep a query from matching across the
  // nama/telepon/alamat boundaries.
  const searchable = useSearchable(
    pelangganList,
    (p) => `${p.nama}\u0000${p.telepon ?? ''}\u0000${p.alamat ?? ''}`,
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return searchable
      .filter(({ item: p, haystack }) => {
        if (tipe !== 'semua' && p.tipe !== tipe) return false
        return !q || haystack.includes(q)
      })
      .map(({ item }) => item)
  }, [searchable, query, tipe])

  const {
    totalPages,
    pageRows: paged,
    page,
    setPage,
  } = usePagedList(filtered, PAGE_SIZE, JSON.stringify([query, tipe]))

  if (pelangganList.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada pelanggan.</p>
    )
  }

  return (
    <div className="space-y-3">
      <FilterBar
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Cari nama, telepon, atau alamat..."
        selectValue={tipe}
        onSelectChange={setTipe}
        selectOptions={tipeOptions}
      />

      {filtered.length === 0 ? (
        <EmptyState message="Tidak ada pelanggan yang cocok. Coba kata kunci lain atau ubah filter." />
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-2 sm:hidden">
            {paged.map((p) => (
              <PelangganRowCard key={p.id} p={p} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nama</th>
                  <th className="text-left px-4 py-3 font-medium">Telepon</th>
                  <th className="text-left px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.map((p) => (
                  <PelangganRowTableRow key={p.id} p={p} />
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}
