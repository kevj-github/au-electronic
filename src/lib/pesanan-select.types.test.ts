import { describe, it, expect } from 'vitest'
import { DETAIL_ITEM_COLUMNS, itemsEmbed } from './pesanan-select'
import type { HelperSafeColumns, PricedColumnsIn } from './pesanan-select'

/**
 * Compile-time coverage for the helper-select guard.
 *
 * The runtime assertions in pesanan-select.test.ts check the strings this
 * module produces. What they cannot check is the thing that actually prevents
 * the mistake: that asking for a price on the helper path does not compile.
 * `@ts-expect-error` inverts that — each one fails the build if the line it
 * guards ever starts type-checking, so `npm run build` and `tsc --noEmit`
 * enforce the rule directly.
 *
 * These are type assertions; the runtime `expect`s exist only so vitest reports
 * the file.
 */

/** Compiles only if T and U are the same type. */
type Equals<T, U> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2
  ? true
  : false
/** Accepts only `true`, so an assertion that fails is a compile error. */
const typeAssert = <T extends true>(): T => true as T

describe('PricedColumnsIn identifies priced columns by whole token', () => {
  it('finds the priced columns in a list', () => {
    typeAssert<Equals<PricedColumnsIn<'qty, harga_satuan'>, 'harga_satuan'>>()
    typeAssert<Equals<PricedColumnsIn<'subtotal'>, 'subtotal'>>()
    typeAssert<Equals<PricedColumnsIn<'jumlah'>, 'jumlah'>>()
    expect(true).toBe(true)
  })

  it('does not mistake jumlah_diambil for jumlah', () => {
    // The trap a substring check would fall into: `jumlah_diambil` is a helper
    // column and must stay selectable.
    typeAssert<Equals<PricedColumnsIn<'jumlah_diambil'>, never>>()
    typeAssert<Equals<PricedColumnsIn<'id, qty, jumlah_diambil'>, never>>()
    expect(true).toBe(true)
  })

  it('tolerates spacing around the commas', () => {
    typeAssert<Equals<PricedColumnsIn<'qty,harga_satuan'>, 'harga_satuan'>>()
    typeAssert<Equals<PricedColumnsIn<'qty,   harga_satuan'>, 'harga_satuan'>>()
    expect(true).toBe(true)
  })
})

describe('HelperSafeColumns', () => {
  it('passes a clean literal through unchanged', () => {
    typeAssert<Equals<HelperSafeColumns<'id, qty'>, 'id, qty'>>()
    typeAssert<Equals<HelperSafeColumns<typeof DETAIL_ITEM_COLUMNS.helper>, typeof DETAIL_ITEM_COLUMNS.helper>>()
    expect(true).toBe(true)
  })

  it('collapses to never when a priced column is named', () => {
    typeAssert<Equals<HelperSafeColumns<'qty, subtotal'>, never>>()
    typeAssert<Equals<HelperSafeColumns<typeof DETAIL_ITEM_COLUMNS.owner>, never>>()
    expect(true).toBe(true)
  })

  it('rejects a widened string, which cannot be checked', () => {
    // Without this the guarantee would silently lapse wherever a column list
    // lost its literal type.
    typeAssert<Equals<HelperSafeColumns<string>, never>>()
    expect(true).toBe(true)
  })
})

describe('itemsEmbed enforces the rule at the call site', () => {
  it('accepts helper-safe column lists', () => {
    expect(itemsEmbed(false, 'id, qty, jumlah_diambil')).toBe(
      'items:item_pesanan(id, qty, jumlah_diambil)',
    )
    expect(itemsEmbed(false, DETAIL_ITEM_COLUMNS.helper)).toContain('items:item_pesanan(')
  })

  it('rejects harga_satuan on the helper path', () => {
    // @ts-expect-error helper selects must not request a priced column
    itemsEmbed(false, 'id, qty, harga_satuan')
    expect(true).toBe(true)
  })

  it('rejects subtotal on the helper path', () => {
    // @ts-expect-error helper selects must not request a priced column
    itemsEmbed(false, 'subtotal')
    expect(true).toBe(true)
  })

  it('rejects jumlah on the helper path', () => {
    // @ts-expect-error helper selects must not request a priced column
    itemsEmbed(false, 'jumlah')
    expect(true).toBe(true)
  })

  it('rejects the owner column list on the helper path', () => {
    // @ts-expect-error the owner list carries harga_satuan and subtotal
    itemsEmbed(false, DETAIL_ITEM_COLUMNS.owner)
    expect(true).toBe(true)
  })

  it('rejects a runtime-built string on the helper path', () => {
    const built: string = ['id', 'qty'].join(', ')
    // @ts-expect-error a widened string cannot be verified, so it is refused
    itemsEmbed(false, built)
    expect(true).toBe(true)
  })

  it('still allows the owner path to read prices', () => {
    expect(itemsEmbed(true, DETAIL_ITEM_COLUMNS.owner)).toContain('harga_satuan')
    expect(itemsEmbed(true, 'harga_satuan, subtotal')).toBe(
      'items:item_pesanan_owner(harga_satuan, subtotal)',
    )
  })
})
