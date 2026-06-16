# AU Electronic — Sistem Manajemen Pesanan & Invoice

**Tanggal:** 16 Juni 2026  
**Status:** Disetujui

---

## Ringkasan

Sistem web internal untuk toko spare part elektronik AU Electronic. Menggantikan pencatatan manual di kertas dan WhatsApp dengan aplikasi terpusat untuk membuat pesanan, mengatur harga secara fleksibel, mencetak invoice/nota, dan melacak pembayaran. Bahasa antarmuka: Bahasa Indonesia.

---

## 1. Arsitektur & Tech Stack

```
Vercel
└── Next.js App (App Router)
    ├── Frontend (React, Tailwind CSS + shadcn/ui)
    ├── API Routes / Server Actions
    └── PDF Generation (react-pdf)

Supabase (managed cloud)
├── PostgreSQL — database utama
├── Auth — login email/password, role-based
└── Storage — file PDF invoice/nota
```

- **Frontend + API:** Next.js (App Router) di-deploy ke Vercel
- **Database & Auth:** Supabase (PostgreSQL + Supabase Auth)
- **PDF:** Di-generate on-demand via react-pdf, disimpan di Supabase Storage
- **WhatsApp:** Format teks di-copy ke clipboard — tidak ada integrasi API, helper paste manual

---

## 2. Database Schema

```sql
-- Pengguna sistem
users
  id            uuid PK
  email         text
  role          enum('owner', 'helper')
  nama          text
  created_at    timestamptz

-- Pelanggan toko
pelanggan
  id            uuid PK
  nama          text
  telepon       text
  alamat        text
  tipe          enum('retail', 'grosir')   -- menentukan template dokumen default
  created_at    timestamptz

-- Katalog produk
produk
  id            uuid PK
  nama          text
  deskripsi     text
  satuan        text   -- pcs, set, unit, dll
  harga_dasar   numeric
  aktif         boolean
  created_at    timestamptz

-- Pesanan
pesanan
  id            uuid PK
  kode_pesanan  text UNIQUE   -- auto-generated: INV-2026-0001 / NOT-2026-0001
  pelanggan_id  uuid FK nullable   -- null jika pelanggan tidak terdaftar
  nama_pelanggan text nullable     -- diisi jika pelanggan tidak terdaftar
  tipe_dokumen  enum('invoice', 'nota')
  status        enum('draft', 'konfirmasi', 'diproses', 'selesai', 'dibatalkan')
  catatan       text
  dibuat_oleh   uuid FK -> users
  created_at    timestamptz

-- Item dalam pesanan
item_pesanan
  id            uuid PK
  pesanan_id    uuid FK
  produk_id     uuid FK
  qty           numeric
  harga_satuan  numeric   -- harga final setelah override owner
  diskon        numeric default 0
  subtotal      numeric   -- computed: qty * harga_satuan - diskon
  catatan_item  text

-- Pembayaran per pesanan
pembayaran
  id            uuid PK
  pesanan_id    uuid FK
  jumlah        numeric
  metode        enum('tunai', 'transfer', 'lainnya')
  catatan       text
  dibayar_pada  timestamptz
  dicatat_oleh  uuid FK -> users
```

**Kalkulasi saldo per pesanan:**
- `total_pesanan` = SUM(item_pesanan.subtotal)
- `total_dibayar` = SUM(pembayaran.jumlah)
- `sisa_tagihan` = total_pesanan - total_dibayar
- Status otomatis `lunas` jika sisa_tagihan = 0

---

## 3. Role & Hak Akses

| Fitur                          | Owner | Helper |
|-------------------------------|-------|--------|
| Buat pesanan baru             | ✓     | ✓      |
| Tambah pelanggan baru         | ✓     | ✓ (lihat saja) |
| Input nama pelanggan bebas    | ✓     | ✓      |
| Ubah harga per item           | ✓     | ✗      |
| Konfirmasi / ubah status      | ✓     | ✗      |
| Cetak invoice / nota          | ✓     | ✓      |
| Copy teks WhatsApp            | ✓     | ✓      |
| Catat pembayaran              | ✓     | ✗      |
| Hapus pembayaran              | ✓     | ✗      |
| Kelola katalog produk         | ✓     | ✗      |
| Kelola akun helper            | ✓     | ✗      |
| Lihat dashboard piutang       | ✓     | ✗      |

---

## 4. Halaman & Navigasi

### Owner
```
/login                  — halaman login
/dashboard              — ringkasan: pesanan aktif, piutang, penjualan hari ini
/pesanan                — daftar semua pesanan + filter status
/pesanan/baru           — buat pesanan baru
/pesanan/[id]           — detail pesanan: edit item, ubah harga, catat pembayaran, cetak
/pelanggan              — daftar pelanggan + riwayat pesanan
/pelanggan/baru         — tambah pelanggan
/pelanggan/[id]         — detail pelanggan
/produk                 — kelola katalog + harga dasar
/pengaturan             — kelola akun helper
```

### Helper
```
/login
/pesanan                — hanya pesanan yang dibuat sendiri
/pesanan/baru           — buat pesanan (harga tidak bisa diubah)
/pesanan/[id]           — lihat detail, cetak invoice/nota, copy WhatsApp
/pelanggan              — lihat daftar saja
```

---

## 5. Alur Pembuatan Pesanan

1. Helper/owner buka `/pesanan/baru`
2. Pilih pelanggan dari database → atau ketik nama langsung jika tidak ada
3. Pilih tipe dokumen: Invoice (B2B) atau Nota (B2C)
4. Tambah produk: cari produk → isi qty → `harga_satuan` terisi otomatis dari `harga_dasar`
5. **Owner saja:** ubah `harga_satuan` per item sesuai kesepakatan
6. Tambah catatan jika perlu
7. Simpan sebagai Draft → atau langsung Konfirmasi
8. Dari halaman detail: cetak PDF atau copy teks WhatsApp

---

## 6. Format Invoice & Nota

### Invoice (B2B — formal)
```
[Logo]                    AU Electronic
                          [Alamat, Telepon]
INVOICE
No: INV-2026-0001
Tanggal: 16 Juni 2026
Kepada: [Nama Pelanggan / Alamat]

No  Produk          Qty   Harga Satuan   Subtotal
1   Dinamo Mesin    5     Rp 150.000     Rp 750.000
2   Remote TV       10    Rp  45.000     Rp 450.000

                          Total  : Rp 1.200.000
                    Sudah Dibayar: Rp   500.000
                           Sisa  : Rp   700.000

Catatan: ...
```

### Nota (B2C — ringkas)
```
======= AU Electronic =======
Nota #: NOT-2026-0042
Tgl: 16/06/2026
Pelanggan: Budi

Dinamo Mesin  5x Rp150.000 = Rp  750.000
Remote TV    10x Rp 45.000 = Rp  450.000

Total    : Rp 1.200.000
Dibayar  : Rp   500.000
Sisa     : Rp   700.000
=============================
```

### Teks WhatsApp (copy ke clipboard)
```
*AU Electronic*
Pesanan #NOT-2026-0042 | 16/06/2026
Pelanggan: Budi

• Dinamo Mesin – 5x Rp150.000 = *Rp750.000*
• Remote TV – 10x Rp45.000 = *Rp450.000*

*Total: Rp1.200.000*
Dibayar: Rp500.000
*Sisa: Rp700.000*

Terima kasih!
```

---

## 7. Pencatatan Pembayaran

- Owner membuka detail pesanan → klik "Catat Pembayaran"
- Input: jumlah, metode (Tunai / Transfer / Lainnya), tanggal, catatan
- Beberapa pembayaran bisa dicatat untuk satu pesanan (cicilan)
- Sisa tagihan otomatis berkurang
- Status otomatis berubah ke `Lunas` jika sisa = 0
- Owner bisa hapus pembayaran yang salah input

---

## 8. Dashboard (Owner)

- Total pesanan aktif hari ini
- Total piutang (sisa tagihan dari semua pesanan belum lunas), diurutkan dari paling lama
- Ringkasan penjualan hari ini / minggu ini

---

## 9. Prinsip Utama Desain

- **Fleksibilitas owner adalah prioritas** — sistem tidak pernah memblokir keputusan harga atau bisnis owner
- **Harga selalu dimulai dari `harga_dasar`** — tidak ada tier otomatis, owner override langsung di item
- **Paper-friendly** — PDF invoice/nota bisa dicetak kapan saja untuk pelanggan yang ingin dokumen fisik
- **Mobile-friendly** — helper kemungkinan pakai HP, UI harus responsif

---

## 10. Out of Scope (Fase 1)

- Manajemen stok / inventaris
- Laporan keuangan lanjutan
- Integrasi WhatsApp API
- Notifikasi otomatis ke pelanggan
- Multi-toko / multi-cabang
