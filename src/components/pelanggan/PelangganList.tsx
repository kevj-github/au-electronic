'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState } from '@/components/ui/empty-state'
import { DeletePelangganButton } from './DeletePelangganButton'
import { useSearchable } from '@/hooks/use-searchable'
import { usePagedList } from '@/hooks/use-paged-list'
import type { Pelanggan, TipePelanggan } from '@/lib/types'

interface PelangganListProps {
  pelangganList: Pelanggan[]
}

const PAGE_SIZE = 10

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
      <p className='text-muted-foreground text-sm'>Belum ada pelanggan.</p>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex gap-2 flex-wrap'>
        <div className='relative flex-1 min-w-[200px]'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Cari nama, telepon, atau alamat...'
            className='pl-9'
          />
        </div>
        <select
          value={tipe}
          onChange={(e) => setTipe(e.target.value as TipePelanggan | 'semua')}
          className='border rounded-md px-3 py-2 text-sm'
        >
          <option value='semua'>Semua tipe</option>
          <option value='retail'>Retail</option>
          <option value='grosir'>Grosir</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message='Tidak ada pelanggan yang cocok. Coba kata kunci lain atau ubah filter.' />
      ) : (
        <>
          {/* Mobile: card list */}
          <div className='space-y-2 sm:hidden'>
            {paged.map((p) => (
              <div key={p.id} className='border rounded-lg p-3'>
                <div className='flex justify-between items-start'>
                  <p className='font-medium text-sm'>{p.nama}</p>
                  <Badge
                    variant={p.tipe === 'grosir' ? 'default' : 'secondary'}
                  >
                    {p.tipe === 'grosir' ? 'Grosir' : 'Retail'}
                  </Badge>
                </div>
                <p className='text-sm text-muted-foreground mt-1'>
                  {p.telepon ?? '—'}
                </p>
                <div className='flex items-center gap-2 mt-2'>
                  <Link href={`/pelanggan/${p.id}`}>
                    <Button variant='outline' size='sm'>
                      Edit
                    </Button>
                  </Link>
                  <DeletePelangganButton pelangganId={p.id} />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className='hidden sm:block border rounded-lg overflow-hidden overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 border-b'>
                <tr>
                  <th className='text-left px-4 py-3 font-medium'>Nama</th>
                  <th className='text-left px-4 py-3 font-medium'>Telepon</th>
                  <th className='text-left px-4 py-3 font-medium'>Tipe</th>
                  <th className='px-4 py-3' />
                </tr>
              </thead>
              <tbody className='divide-y'>
                {paged.map((p) => (
                  <tr key={p.id} className='hover:bg-gray-50'>
                    <td className='px-4 py-3 font-medium'>{p.nama}</td>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {p.telepon ?? '—'}
                    </td>
                    <td className='px-4 py-3'>
                      <Badge
                        variant={p.tipe === 'grosir' ? 'default' : 'secondary'}
                      >
                        {p.tipe === 'grosir' ? 'Grosir' : 'Retail'}
                      </Badge>
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <Link href={`/pelanggan/${p.id}`}>
                          <Button variant='outline' size='sm'>
                            Edit
                          </Button>
                        </Link>
                        <DeletePelangganButton pelangganId={p.id} />
                      </div>
                    </td>
                  </tr>
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
