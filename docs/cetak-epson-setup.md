# Cetak Epson (LX-310) — Setup & Verifikasi

Fitur "Cetak Epson" mengirim struk sebagai teks ESC/P mentah ke printer dot-matrix
Epson LX-310 lewat QZ Tray, sehingga hasil cetak tajam (memakai font bawaan
printer) — berbeda dari "Cetak PDF" yang berbasis gambar.

## Setup satu kali (di PC Windows kasir)

1. Install **QZ Tray** dan biarkan berjalan di system tray. Saat pertama kali
   mencetak, klik **Allow** (centang "remember") pada dialog izin QZ.
2. Buka **Pengaturan → Printer**, klik **Deteksi Printer**, pilih LX-310, lalu
   **Simpan**. (Bisa juga ketik manual nama printer persis seperti di Windows.)
3. Di Windows, atur ukuran form/kertas printer menjadi **9.5 × 5.5 inch**.

**Catatan penting:** Nama printer yang disimpan di Pengaturan harus cocok persis dengan nama printer di Windows. Nama ini disimpan per instalasi aplikasi — jika PC kasir diganti atau printer direname di Windows, pengaturan ini harus diperbarui lagi.

## Verifikasi di hardware (checklist)

- [ ] Struk pendek (1 halaman): teks tajam, tidak buram, tanpa dither/abu-abu.
- [ ] Kolom kanan (Tgl. Pesanan / Tgl. Pengiriman) tidak terpotong.
- [ ] Nama & alamat pelanggan tercetak penuh (baris sendiri di bawah "Kepada Yth:"),
      tidak terpotong seperti di PDF.
- [ ] Angka rapi rata kanan di kolom HARGA & JUMLAH; baris SUBTOTAL dan TOTAL
      berakhir tepat di ujung kolom JUMLAH.
- [ ] Item dengan nama panjang (>34 karakter, jadi 2 baris): halaman tetap muat
      dalam satu form — tidak ada isi yang melewati perforasi.
- [ ] Struk panjang (>1 halaman): halaman ke-2 mulai tepat di atas form berikutnya
      (form-feed benar); TOTAL hanya muncul di halaman terakhir.
- [ ] Setelah cetak, kertas berhenti di awal form berikutnya (siap struk baru).
- [ ] Pengaturan → Printer (input nama, tombol "Deteksi Printer", dan "Simpan")
      tetap dapat digunakan dan tidak ada yang melampaui batas layar saat dibuka
      di lebar/viewport mobile yang sempit.

## Penyetelan bila perlu (di kode)

Semua di `src/lib/escp.ts`:

- **Panjang halaman: `LINES_PER_PAGE` (default 33).** Satu konstanta ini yang
  dipakai untuk perintah `ESC C n` *sekaligus* untuk anggaran baris per halaman —
  ubah di satu tempat kalau ukuran form berubah.
- **Jumlah item per halaman tidak diatur manual.** Halaman dipecah berdasarkan
  *anggaran baris*, bukan hitungan item, karena nama barang yang panjang memakai
  baris tambahan. Rumusnya:
  `anggaran item = LINES_PER_PAGE − baris header (5, atau 6 bila ada alamat)
  − 3 (garis + judul kolom) − 1 (SUBTOTAL) − 8 (footer)`, dikurangi 2 lagi di
  halaman terakhir (baris kosong + TOTAL). Jadi 16/14 baris item tanpa alamat,
  15/13 dengan alamat. Konstanta `TABLE_HEAD_LINES`, `SUBTOTAL_LINES`,
  `FOOTER_LINES`, dan `TOTAL_LINES` yang memegang angka-angka itu.
- **Lebar kolom: konstanta `COL`** — totalnya harus tetap 79 kolom
  (3 + 5 + 34 + 13 + 13 + 6 + 5 pemisah = 79). Angka yang lebih lebar dari
  kolomnya dicetak dengan penanda `#` di depan (digit paling kanan dipertahankan),
  jadi nilai terpotong langsung terlihat salah.
