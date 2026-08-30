'use server'

import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/pesanan-guards'
import { pesananListSelect } from '@/lib/pesanan-select'
import { toOrderRows, type OrderRow, type PesananWithRelations } from '@/components/pesanan/order-row'
import { escapeIlike } from '@/lib/utils'
import type { ActionResult } from '@/lib/action-result'
import type { StatusPesanan } from '@/lib/types'

const SEARCH_RESULT_LIMIT = 50

/**
 * Full-table fallback for when a search on /pesanan misses because the match
 * lives past `PESANAN_LIST_LIMIT` (500 rows). Only called from the client when
 * the local filter comes back empty and the list was actually capped.
 *
 * Runs two plain `.ilike()` queries (kode_pesanan, nama_pelanggan) rather than
 * one `.or('kode_pesanan.ilike.%x%,nama_pelanggan.ilike.%x%')`: an `.or()`
 * string is parsed as PostgREST filter grammar, so a comma or parenthesis
 * typed by the user would land inside that grammar instead of staying a plain
 * value. Two `.ilike()` calls keep the query text a parameter value.
 *
 * Only matches the base table's own columns, same as the client-side filter
 * on the initial 500 — a customer renamed after the order was placed won't be
 * found by their new name here, only by whatever `nama_pelanggan` was
 * snapshotted at creation. Good enough for "find that old order past the
 * cap"; matching against the live `pelanggan` name is out of scope.
 */
export async function searchPesananGlobal(
  query: string,
  status: StatusPesanan | 'semua',
): Promise<ActionResult<{ rows?: OrderRow[] }>> {
  const supabase = await createClient()
  const role = await getRole(supabase)
  if (role === null) return { error: 'Tidak terautentikasi.' }
  const isOwner = role === 'owner'

  const q = query.trim()
  if (!q) return { rows: [] }

  const pattern = `%${escapeIlike(q)}%`
  const select = pesananListSelect(isOwner)

  function baseQuery() {
    const b = supabase.from('pesanan').select(select)
    // Mirrors the page's own role-based scoping: helpers only ever see
    // Diproses orders, owners can narrow by the status filter they had active.
    if (!isOwner) return b.eq('status', 'diproses')
    if (status !== 'semua') return b.eq('status', status)
    return b
  }

  const [byKode, byNama] = await Promise.all([
    baseQuery()
      .ilike('kode_pesanan', pattern)
      .order('created_at', { ascending: false })
      .limit(SEARCH_RESULT_LIMIT)
      .returns<PesananWithRelations[]>(),
    baseQuery()
      .ilike('nama_pelanggan', pattern)
      .order('created_at', { ascending: false })
      .limit(SEARCH_RESULT_LIMIT)
      .returns<PesananWithRelations[]>(),
  ])

  if (byKode.error || byNama.error) return { error: 'Gagal mencari pesanan.' }

  const seen = new Map<string, PesananWithRelations>()
  for (const row of [...(byKode.data ?? []), ...(byNama.data ?? [])]) {
    seen.set(row.id, row)
  }
  const merged = Array.from(seen.values())
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, SEARCH_RESULT_LIMIT)

  // The helper select above already omits tanggal_pengiriman — mirrors the
  // page's own masking so a helper's search result carries the same shape.
  const visible = isOwner
    ? merged
    : merged.map((p) => ({ ...p, tanggal_pengiriman: null }))

  return { rows: toOrderRows(visible, isOwner) }
}
