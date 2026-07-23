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

- [ ] Struk pendek (≤12 item): teks tajam, tidak buram, tanpa dither/abu-abu.
- [ ] Kolom kanan (Tgl. Pesanan / Tgl. Pengiriman) tidak terpotong.
- [ ] Angka rapi rata kanan di kolom HARGA & JUMLAH.
- [ ] Struk panjang (>12 item): halaman ke-2 mulai tepat di atas form berikutnya
      (form-feed benar); TOTAL hanya muncul di halaman terakhir.
- [ ] Setelah cetak, kertas berhenti di awal form berikutnya (siap struk baru).
- [ ] Pengaturan → Printer (input nama, tombol "Deteksi Printer", dan "Simpan")
      tetap dapat digunakan dan tidak ada yang melampaui batas layar saat dibuka
      di lebar/viewport mobile yang sempit.

## Penyetelan bila perlu (di kode)

- Baris per halaman: `ITEMS_PER_PAGE` di `src/lib/escp.ts`.
- Panjang halaman: konstanta `PAGE_LENGTH_33` (ESC C n) di `src/lib/escp.ts`.
- Lebar kolom: konstanta `COL` di `src/lib/escp.ts`.
