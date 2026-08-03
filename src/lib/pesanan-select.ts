/**
 * PostgREST select fragments for `pesanan` and its embedded relations.
 *
 * What this centralises is the one thing that must never vary per call site:
 * WHICH SOURCE each role reads priced data from.
 *
 * Owners read prices through the owner-gated views (`item_pesanan_owner` /
 * `pembayaran_owner`), never the base tables. Migration
 * `20260801111127_price_column_masking_phase3_revoke` revoked column SELECT on
 * harga_satuan/subtotal/jumlah from `authenticated`, and an owner is also just
 * `authenticated` — so a base-table read of those columns fails outright with
 * `42501 permission denied`, taking the whole query (and every row in it) with
 * it. That is not hypothetical: it is exactly how the order list silently
 * rendered "0 pesanan" while 118 rows sat in the table.
 *
 * Helpers read the base `item_pesanan` and ask for no priced column at all.
 * RLS restricts rows, not columns, so the guarantee that a price never reaches
 * a helper's RSC payload comes from simply not fetching it. Payments are
 * owner-only data, so there is no helper payment source at all.
 */

/** Where item rows are read from, per role. */
export const ITEMS_SOURCE = {
  owner: 'item_pesanan_owner',
  helper: 'item_pesanan',
} as const

/** Payments are owner-only — there is deliberately no helper source. */
export const PEMBAYARAN_SOURCE = 'pembayaran_owner' as const

/**
 * Build the `items:` embed against the owner view or the base table according
 * to the caller's role. Always aliased to `items` so consumers read one
 * property name regardless of which source was used.
 */
export function itemsEmbed(isOwner: boolean, columns: string): string {
  return `items:${isOwner ? ITEMS_SOURCE.owner : ITEMS_SOURCE.helper}(${columns})`
}

/**
 * Build the `pembayaran:` embed. Owner-only by construction — it takes no role
 * parameter because a helper must never be handed a payment embed at all.
 */
export function pembayaranEmbed(columns: string): string {
  return `pembayaran:${PEMBAYARAN_SOURCE}(${columns})`
}
