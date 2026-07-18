# Design: Owner/Helper visibility, PDF formatting, and price-input separators

Date: 2026-07-18

## Overview

Four independent changes to the AU Electronic order-management app:

1. Restrict **tanggal pengiriman** (delivery date) to the owner account.
2. Rework the **pesanan PDF** for readability and per-page completeness.
3. Hide the **customer phone number** from helper accounts.
4. Add **live thousands separators** (dot style) to owner price inputs.

No database, schema, or RLS changes. The PDF generator (`DocumentPDF.tsx`) is
already gated to owner-only rendering, so its changes have no role implications.

## Shared helpers (`src/lib/utils.ts`)

- `formatNumberID(n: number): string` → `n.toLocaleString('id-ID')` — dot-grouped,
  **no** `Rp` prefix. Used by the PDF number cells, per-page subtotal, and grand total.
- A digit-formatting pair for the live price inputs:
  - format: raw digit string → dot-grouped display (e.g. `"1000000"` → `"1.000.000"`).
  - parse: display string → raw digits (strip everything non-digit).
  Store the raw digit string in component state; render the formatted value.

Indonesian dot convention is used (matches existing `formatRupiah` and the PDF),
not commas.

## 1. Tanggal pengiriman → owner-only, everywhere

- **`src/app/(app)/pesanan/[id]/page.tsx`**: wrap the entire "Tgl. Pengiriman"
  block (label + editor/value) in `{isOwner && (…)}`. Helpers see nothing —
  not even "Belum ditentukan". Remove the helper-facing read-only branch.
- **`src/components/pesanan/OrderList.tsx`**:
  - Desktop table: gate the `Tgl. Pengiriman` `<th>` and its `<td>` behind `isOwner`.
  - Mobile card: gate the "Pengiriman:" paragraph behind `isOwner`.
- **`src/components/pesanan/OrderForm.tsx`**: already gates the delivery-date
  input to owner (`{isOwner && …}`) — no change.

## 2. Pesanan PDF (`src/components/invoice/DocumentPDF.tsx`)

- `ITEMS_PER_PAGE`: `15` → `12`.
- **Footer on every page**: the Perhatian box and the Penerima signature block
  render on **every** page. The grand **Total** area renders on the **last page
  only**. The per-page **Subtotal** row continues to render on each page.
  - Implementation: move the signature block out of the `isLastPage` guard;
    keep only the `totalArea` inside `isLastPage`.
- **Larger fonts throughout**: scale up the base `fontSize` (9 → ~11) and the
  proportional sizes for column headers, item rows, logo/meta text, subtotal,
  and total, so a printout is easier to read. **Keep `paddingHorizontal: 48`
  unchanged.** Row vertical padding may be reduced if needed to fit 12 rows +
  footer at the larger font on A5 landscape; horizontal padding is untouched.
- **Uppercase the table region**: column header labels, item-name data, the
  per-page `SUBTOTAL` label, and the grand `TOTAL` label render in caps. The
  logo/address header block and the date lines (Tgl. Pesanan / Tgl. Pengiriman /
  Kepada Yth) are **not** uppercased.
- **Drop `Rp` from numeric values**: harga satuan cells, jumlah cells, per-page
  subtotal, and grand total use `formatNumberID` (plain dot-grouped number).
  `Rp` appears only in the column headers: `HARGA SATUAN (Rp)` and `JUMLAH (Rp)`.
- **Bold the customer address** (`kepadaAlamat`) rendered under the customer name.

Verification: render the PDF and confirm 12 rows + footer fit on A5 landscape
without overflow.

## 3. Phone number → hidden from helpers

- **`src/app/(app)/pesanan/[id]/page.tsx`**: gate the `pesanan.pelanggan?.telepon`
  paragraph behind `isOwner`. The Pelanggan list and detail pages already redirect
  non-owners, so the order detail page is the only helper-visible surface.

## 4. Owner price inputs → live thousands separators (dot)

- **`src/components/pesanan/BulkPriceForm.tsx`**: Harga Satuan inputs change from
  `type="number"` to `type="text"` with `inputMode="numeric"`. Display the
  dot-formatted value; keep the raw digit string in state (consistent with the
  existing raw-string-in-state convention). `handleSave` parses the raw digits.
- **`src/components/pesanan/PaymentModal.tsx`**: the Jumlah field gets the same
  treatment. Because the form submits via `FormData` and `createPembayaran` does
  `Number(formData.get('jumlah'))`, feed the raw (dot-free) digits to the server
  through a hidden `jumlah` input, while the visible input is the formatted,
  controlled text field. Initial value seeds from `sisaTagihan`.

## Verification

- `npm run build` (catches Server Action / async issues).
- `npm run test:run`.
- Manual PDF render to check the new layout.
- Spot-check owner vs helper views for tanggal pengiriman and phone visibility.
