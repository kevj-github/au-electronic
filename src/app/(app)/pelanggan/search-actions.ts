'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/supabase/require-owner'
import type { ActionResult } from '@/lib/action-result'
import type { Pelanggan, TipePelanggan } from '@/lib/types'

const SEARCH_RESULT_LIMIT = 50

/** Escapes ilike's own wildcards so a literal `%`/`_` in the query matches literally. */
function escapeIlike(raw: string): string {
  return raw.replace(/[%_]/g, '\\$&')
}

/**
 * Full-table fallback for /pelanggan search past `PELANGGAN_LIST_LIMIT` (500
 * rows). See searchPesananGlobal in the sibling pesanan route for the
 * rationale on running separate `.ilike()` queries instead of one `.or()`
 * string — same filter-injection concern applies here.
 */
export async function searchPelangganGlobal(
  query: string,
  tipe: TipePelanggan | 'semua',
): Promise<ActionResult<{ pelangganList?: Pelanggan[] }>> {
  const supabase = await createClient()
  const ownerError = await requireOwner(supabase)
  if (ownerError) return ownerError

  const q = query.trim()
  if (!q) return { pelangganList: [] }

  const pattern = `%${escapeIlike(q)}%`

  function baseQuery() {
    const b = supabase.from('pelanggan').select('*')
    return tipe !== 'semua' ? b.eq('tipe', tipe) : b
  }

  const [byNama, byTelepon, byAlamat] = await Promise.all([
    baseQuery().ilike('nama', pattern).order('nama').limit(SEARCH_RESULT_LIMIT).returns<Pelanggan[]>(),
    baseQuery().ilike('telepon', pattern).order('nama').limit(SEARCH_RESULT_LIMIT).returns<Pelanggan[]>(),
    baseQuery().ilike('alamat', pattern).order('nama').limit(SEARCH_RESULT_LIMIT).returns<Pelanggan[]>(),
  ])

  if (byNama.error || byTelepon.error || byAlamat.error) {
    return { error: 'Gagal mencari pelanggan.' }
  }

  const seen = new Map<string, Pelanggan>()
  for (const row of [...(byNama.data ?? []), ...(byTelepon.data ?? []), ...(byAlamat.data ?? [])]) {
    seen.set(row.id, row)
  }
  const merged = Array.from(seen.values())
    .sort((a, b) => a.nama.localeCompare(b.nama))
    .slice(0, SEARCH_RESULT_LIMIT)

  return { pelangganList: merged }
}
