export interface SectionItem {
  id: string
  nama_barang: string
  qty: number
  jumlah_diambil: number
  dicek_oleh_owner?: boolean
  // Price fields are only present for owners (helpers never receive them).
  harga_satuan?: number
  subtotal?: number
}

export interface EditState {
  nama_barang: string
  qty: string
}

export const emptyAdd: EditState = { nama_barang: '', qty: '' }

export function rawPrice(item: SectionItem, priceOverrides: Record<string, string>): string {
  return priceOverrides[item.id] ?? (item.harga_satuan && item.harga_satuan > 0 ? String(item.harga_satuan) : '')
}

export function numPrice(item: SectionItem, priceOverrides: Record<string, string>): number {
  return parseInt(rawPrice(item, priceOverrides) || '0', 10) || 0
}

export function subtotalOf(item: SectionItem, priceOverrides: Record<string, string>): number {
  return item.qty * numPrice(item, priceOverrides)
}
