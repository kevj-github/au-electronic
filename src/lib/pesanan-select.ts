/**
 * PostgREST select fragments for `pesanan` and its embedded relations.
 *
 * Every page that reads an order needs a slightly different shape, so this does
 * not try to collapse them into one string. What it does centralise is the part
 * that must never vary: WHICH SOURCE each role reads from, and WHICH COLUMNS a
 * helper is allowed to ask for.
 *
 * Two rules are encoded here, both security-relevant:
 *
 *  1. Owners read priced data through the owner-gated views
 *     (`item_pesanan_owner` / `pembayaran_owner`), never the base tables. The
 *     phase 3 migration revoked column SELECT on harga_satuan/subtotal/jumlah
 *     from `authenticated`, and the owner is also just `authenticated`, so a
 *     base-table read of those columns now fails outright.
 *  2. Helpers read the base `item_pesanan` and select no priced column at all.
 *     RLS restricts rows, not columns, so the guarantee that a price never
 *     reaches a helper's RSC payload comes from simply not asking for it.
 *
 * Before this module those two rules lived as prose comments duplicated across
 * four files, with the view names hardcoded into four separate string literals.
 * `pesanan-select.test.ts` now asserts them instead.
 */

/**
 * Columns carrying price or payment data. A helper-facing select must contain
 * none of these. Used by the tests that enforce rule 2 above.
 */
export const PRICED_COLUMNS = ['harga_satuan', 'subtotal', 'jumlah'] as const

export type PricedColumn = (typeof PRICED_COLUMNS)[number]

/** Strip surrounding spaces from a string literal type. */
type Trim<S extends string> = S extends ` ${infer R}`
  ? Trim<R>
  : S extends `${infer R} `
    ? Trim<R>
    : S

/**
 * A PostgREST column list literal split into its individual column names.
 *
 * Tokenising matters: a naive `S extends \`${string}jumlah${string}\`` check
 * would reject `jumlah_diambil`, which is a helper column and must stay
 * readable. Comparing whole tokens keeps `jumlah` and `jumlah_diambil` distinct.
 */
type SplitColumns<S extends string> = S extends `${infer Head},${infer Rest}`
  ? Trim<Head> | SplitColumns<Rest>
  : Trim<S>

/** Which priced columns, if any, a column list asks for. */
export type PricedColumnsIn<S extends string> = Extract<SplitColumns<S>, PricedColumn>

/**
 * `S` if it is a literal naming no priced column, otherwise `never` — so a
 * helper-facing select that asks for a price fails to compile rather than
 * failing a test.
 *
 * The `string extends S` guard rejects a widened `string` too. Without it a
 * value whose type had decayed to plain `string` would slip through unchecked,
 * which is the one case where the guarantee would be silently absent.
 */
export type HelperSafeColumns<S extends string> = string extends S
  ? never
  : [PricedColumnsIn<S>] extends [never]
    ? S
    : never

/** Where item rows are read from, per role. See rule 1. */
export const ITEMS_SOURCE = {
  owner: 'item_pesanan_owner',
  helper: 'item_pesanan',
} as const

/** Payments are owner-only data, so there is no helper source at all. */
export const PEMBAYARAN_SOURCE = 'pembayaran_owner' as const

/**
 * Item columns for the order-detail page, per role. The helper set deliberately
 * omits harga_satuan and subtotal — an unfetched column can never reach the
 * browser, which is the whole defence.
 */
export const DETAIL_ITEM_COLUMNS = {
  owner:
    'id, nama_barang, qty, harga_satuan, subtotal, diambil_oleh_helper, dicek_oleh_owner, jumlah_diambil',
  helper: 'id, nama_barang, qty, diambil_oleh_helper, jumlah_diambil',
} as const

/**
 * Build the `items:` embed, pointing at the owner view or the base table
 * according to the caller's role. Always alias to `items` so consumers see one
 * property name regardless of which source was used.
 *
 * The helper overload constrains its column list: `columns` must be a literal
 * naming no priced column, so `itemsEmbed(false, 'harga_satuan')` is a
 * compile error rather than something only a runtime test would notice. The
 * owner overload is unconstrained — reading prices is the point.
 *
 * `S & HelperSafeColumns<S>` rather than `HelperSafeColumns<S>` alone because
 * `S` sits in a non-inferrable position inside a conditional type; the
 * intersection gives inference something to latch onto while still collapsing
 * to `never` when the check fails.
 */
export function itemsEmbed(isOwner: true, columns: string): string
export function itemsEmbed<S extends string>(
  isOwner: false,
  columns: S & HelperSafeColumns<S>,
): string
export function itemsEmbed(isOwner: boolean, columns: string): string {
  return `items:${isOwner ? ITEMS_SOURCE.owner : ITEMS_SOURCE.helper}(${columns})`
}

/**
 * Build the `pembayaran:` embed. Owner-only by construction — there is no role
 * parameter because a helper must never be given a payment embed at all.
 */
export function pembayaranEmbed(columns: string): string {
  return `pembayaran:${PEMBAYARAN_SOURCE}(${columns})`
}

/**
 * The exact `pesanan` select used by the /pesanan list page, shared with its
 * full-table search fallback (`searchPesananGlobal`) so the two can never
 * drift apart on which columns/embeds each role is allowed to see.
 */
export function pesananListSelect(isOwner: boolean): string {
  return isOwner
    ? `*, pelanggan(nama, alamat), ${itemsEmbed(true, 'subtotal, diambil_oleh_helper')}, ${pembayaranEmbed('jumlah')}`
    : `id, kode_pesanan, nama_pelanggan, status, created_at, pelanggan(nama, alamat), ${itemsEmbed(false, 'diambil_oleh_helper')}`
}
