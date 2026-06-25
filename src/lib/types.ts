export type UserRole = 'owner' | 'helper'

export type TipePelanggan = 'retail' | 'grosir'

export type StatusPesanan =
  | 'draft'
  | 'konfirmasi'
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
  dibuat_oleh: string
  created_at: string
  updated_at: string
  pelanggan?: Pelanggan
  items?: ItemPesanan[]
  pembayaran?: Pembayaran[]
}

export interface ItemPesanan {
  id: string
  pesanan_id: string
  nama_barang: string
  qty: number
  harga_satuan: number
  diskon: number
  subtotal: number
  catatan_item: string | null
  diambil_oleh_helper: boolean
  dicek_oleh_owner: boolean
}

export interface Pembayaran {
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
