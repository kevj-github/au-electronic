export type UserRole = 'owner' | 'helper'

export type TipePelanggan = 'retail' | 'grosir'

export type StatusPesanan =
  | 'diproses'
  | 'selesai'
  | 'dibatalkan'

export type MetodePembayaran = 'tunai' | 'transfer' | 'lainnya'

export type StatusPembayaran = 'belum_dibayar' | 'bayar_sebagian' | 'lunas'

export interface User {
  id: string
  email: string
  role: UserRole
  nama: string
  created_at: string
}

export interface Pelanggan {
  id: string
  nama: string
  telepon: string | null
  alamat: string | null
  tipe: TipePelanggan
  created_at: string
}

export interface Pesanan {
  id: string
  kode_pesanan: string
  pelanggan_id: string | null
  nama_pelanggan: string | null
  status: StatusPesanan
  catatan: string | null
  tanggal_pengiriman: string | null
  pengiriman: string | null
  /** Number of packages (colly) handed to the courier; printed beside pengiriman. */
  colly: number | null
  dibuat_oleh: string
  created_at: string
  updated_at: string
  pelanggan?: Pelanggan
  items?: ItemPesananOwner[]
  pembayaran?: PembayaranOwner[]
}

/**
 * An item row as a HELPER may see it: every column except the priced ones.
 *
 * The split is the point. `harga_satuan` and `subtotal` are not optional here,
 * they are absent — so a component handed an `ItemPesananHelper` cannot read a
 * price even by accident, and a helper-facing query that selected one would
 * produce a shape that does not fit. Mirrors the DB, where phase 3 revoked
 * those columns from `authenticated` outright.
 */
export interface ItemPesananHelper {
  id: string
  pesanan_id: string
  nama_barang: string
  qty: number
  catatan_item: string | null
  jumlah_diambil: number
  diambil_oleh_helper: boolean
  dicek_oleh_owner: boolean
}

/**
 * The same row as an OWNER sees it, read through `item_pesanan_owner`. Prices
 * are nullable because the view's columns are: it is a `SECURITY DEFINER` view
 * gated on `current_user_role() = 'owner'`, so a non-owner gets no rows rather
 * than nulls, but the generated types cannot express that.
 */
export interface ItemPesananOwner extends ItemPesananHelper {
  harga_satuan: number
  subtotal: number
}

/**
 * Payments are owner-only in their entirety — there is no helper shape, and
 * `pesanan-select.ts` deliberately offers no helper payment embed. Named
 * `...Owner` anyway so the role is explicit at every use site.
 */
export interface PembayaranOwner {
  id: string
  pesanan_id: string
  jumlah: number
  metode: MetodePembayaran
  catatan: string | null
  dibayar_pada: string
  dicatat_oleh: string
}

export interface SaldoPesanan {
  totalPesanan: number
  totalDibayar: number
  sisaTagihan: number
  statusPembayaran: StatusPembayaran
}
