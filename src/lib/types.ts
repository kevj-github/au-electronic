export type UserRole = 'owner' | 'helper'

export type TipePelanggan = 'retail' | 'grosir'

export type TipeDokumen = 'invoice' | 'nota'

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

export interface Produk {
  id: string
  nama: string
  deskripsi: string | null
  satuan: string
  harga_dasar: number
  aktif: boolean
  created_at: string
}

export interface Pesanan {
  id: string
  kode_pesanan: string
  pelanggan_id: string | null
  nama_pelanggan: string | null
  tipe_dokumen: TipeDokumen
  status: StatusPesanan
  catatan: string | null
  dibuat_oleh: string
  created_at: string
  pelanggan?: Pelanggan
  items?: ItemPesanan[]
  pembayaran?: Pembayaran[]
}

export interface ItemPesanan {
  id: string
  pesanan_id: string
  produk_id: string | null
  nama_custom: string | null
  qty: number
  harga_satuan: number
  diskon: number
  subtotal: number
  catatan_item: string | null
  produk?: Produk | null
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
