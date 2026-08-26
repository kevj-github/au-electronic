import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Database security posture, asserted against the LIVE project.
 *
 * These invariants were previously "verified" by curl commands pasted into
 * migration comments — a record of one moment, checked by nobody afterwards.
 * That is exactly how `anon` kept column SELECT on harga_satuan/subtotal/jumlah
 * from 2026-08-01 (when phase 3 masked those columns from `authenticated`) to
 * 2026-08-05, four days during which anyone holding the public anon key could
 * have read every price had a single RLS policy been loosened.
 *
 * Deliberately NOT part of `npm run test:run`: it needs network access and real
 * credentials. It runs as `npm run test:db`, and is wired into CI separately.
 *
 * It also never skips silently. A security check that quietly passes when it
 * cannot run reproduces the original failure — an unverified invariant that
 * looks verified — so missing credentials fail loudly here, and CI logs an
 * explicit warning if it chooses not to run it at all.
 */

const PRICED = [
  { table: 'item_pesanan', column: 'harga_satuan' },
  { table: 'item_pesanan', column: 'subtotal' },
  { table: 'pembayaran', column: 'jumlah' },
] as const

/** Tables whose WAL images must never reach a helper over the websocket. */
const REALTIME_ALLOWED = ['pelanggan', 'pesanan', 'users']

interface Posture {
  priced_column_grants: Array<{ table: string; column: string; grantee: string }>
  table_select_grants: Array<{ table: string; grantee: string }>
  owner_views: Record<string, { rechecks_owner: boolean; security_invoker: boolean }>
  realtime_tables: string[]
}

let url: string
let anonKey: string
let serviceKey: string
let posture: Posture

/** CI supplies these as real env vars; locally they live in .env.local. */
function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.startsWith('your-') || value === 'placeholder') {
    throw new Error(
      `${name} is not set to a real value. This suite asserts the live database's ` +
        `security posture and must not be run against placeholders — a check that ` +
        `cannot reach the database must fail, not pass quietly.`,
    )
  }
  return value
}

async function rest(path: string, key: string, init: RequestInit = {}) {
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

beforeAll(async () => {
  loadEnvLocal()
  url = required('NEXT_PUBLIC_SUPABASE_URL')
  anonKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')

  const { status, body } = await rest('/rest/v1/rpc/security_posture', serviceKey, {
    method: 'POST',
    body: '{}',
  })
  if (status !== 200) {
    throw new Error(
      `security_posture() did not respond (HTTP ${status}): ${JSON.stringify(body)}. ` +
        `It is defined in supabase/migrations/20260805084725_add_security_posture_function.sql.`,
    )
  }
  posture = body as Posture
})

describe('price columns are masked from every client-facing role', () => {
  it('grants no explicit column SELECT to anon or authenticated', () => {
    expect(posture.priced_column_grants).toEqual([])
  })

  it('grants no table-level SELECT to anon or authenticated', () => {
    // A table grant silently overrides column masking: a NULL column ACL means
    // "inherit the table grant". Checking only column ACLs is what let the anon
    // hole read as safe for four days.
    expect(posture.table_select_grants).toEqual([])
  })

  it.each(PRICED)(
    'refuses $table.$column over REST with the public anon key',
    async ({ table, column }) => {
      const { body } = await rest(`/rest/v1/${table}?select=${column}&limit=1`, anonKey)

      expect(body).toMatchObject({ code: '42501' })
    },
  )

  it('still allows a non-priced column, so the block is scoped not blanket', async () => {
    const { body } = await rest('/rest/v1/item_pesanan?select=nama_barang&limit=1', anonKey)

    // RLS returns no rows to an anonymous caller; that is a [], not a 42501.
    expect(Array.isArray(body)).toBe(true)
  })
})

const OWNER_VIEWS = ['item_pesanan_owner', 'pembayaran_owner', 'pesanan_unpaid_owner']

describe('the owner-gated views', () => {
  it.each(OWNER_VIEWS)('%s exists', (view) => {
    expect(posture.owner_views[view]).toBeDefined()
  })

  it.each(OWNER_VIEWS)('%s re-checks current_user_role() = owner itself', (view) => {
    // These views bypass RLS by design, so their own predicate is the only
    // thing between a helper and every price in the database.
    expect(posture.owner_views[view].rechecks_owner).toBe(true)
  })

  it.each(OWNER_VIEWS)('%s does not run as the invoker', (view) => {
    // security_invoker = true would subject the view to the same revoke it
    // exists to work around, breaking the owner's reads entirely.
    expect(posture.owner_views[view].security_invoker).toBe(false)
  })
})

describe('realtime publication', () => {
  it('contains exactly pelanggan, pesanan and users', () => {
    expect([...posture.realtime_tables].sort()).toEqual([...REALTIME_ALLOWED].sort())
  })

  it.each(['item_pesanan', 'pembayaran'])('never publishes %s', (table) => {
    // Their WAL images carry price/payment data, which would reach a helper's
    // websocket before any role-aware refetch could filter it.
    expect(posture.realtime_tables).not.toContain(table)
  })
})

describe('the posture function itself', () => {
  it('is not callable with the public anon key', async () => {
    const { body } = await rest('/rest/v1/rpc/security_posture', anonKey, {
      method: 'POST',
      body: '{}',
    })

    expect(body).toMatchObject({ code: '42501' })
  })
})
