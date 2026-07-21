# Design: "Cetak Epson" — ESC/P raw printing via QZ Tray

**Date:** 2026-07-21
**Status:** Approved, ready for implementation plan

## Problem

Receipts are printed on an **Epson LX-310**, a 9-pin dot-matrix impact printer,
from the web app's existing "Cetak PDF" flow. That flow renders a graphical PDF
(gray colors, background fills, a bitmap logo, a watermark, and bold fonts
throughout) which the Windows driver rasterizes to the printer's low-resolution
graphics mode. On a 9-pin impact printer this produces:

- **Blur / muddy output** — every non-black color and the logo image get
  dithered into dot patterns; bold text double-strikes and smears.
- **No color handling** — the printer has a single black ribbon; grayscale only
  exists as ugly dither.
- **Cut-off content** — the page is 9.5″ wide but a continuous tractor-feed
  form's *printable* width excludes the ~0.5″ perforation strip on each side, so
  the right-aligned header (dates) overflows; a driver page-length mismatch
  (set to 9.5×5 while the PDF is 9.5×5.5) also clips vertically.

The correct way to drive a dot-matrix printer is to send it **raw text (ESC/P)**
so it uses its own built-in font — crisp, instant, aligned to the character
grid — instead of a rasterized bitmap.

## Goals

- Add an **additive** "Cetak Epson" button that prints a crisp ESC/P text
  receipt. **The existing "Cetak PDF" flow is left completely untouched.**
- Full content parity with the PDF receipt.
- One click per receipt after a one-time setup.

## Non-goals

- Replacing or modifying the PDF document.
- Printing a graphical logo on the Epson (text-only header instead).
- Silent/kiosk QZ printing with a signed certificate (community/unsigned is
  acceptable for a single trusted shop PC).

## Environment / constraints

- **Printer:** Epson LX-310, 9-pin dot matrix, ESC/P (not ESC/P2), single black
  ribbon, ~8″ printable width. Standard command mode.
- **Paper:** continuous tractor-feed form, physical slip size **9.5 × 5.5 inch**
  (including tractor-hole strips). At 6 LPI that is 33 lines/page; at 10 CPI the
  printable width is 80 columns.
- **Host:** Windows PC, printer connected via USB/LPT.
- **App:** Next.js web app (may be hosted remotely). A browser cannot send raw
  bytes to a local USB printer on its own, so a local bridge is required.

## Approach: QZ Tray (raw print bridge)

QZ Tray is a small app installed once on the Windows PC. It runs in the system
tray and exposes a local secure websocket. The browser connects to it and sends
raw ESC/P bytes, which QZ hands to the Windows spooler in **RAW mode**, bypassing
the driver's rasterization. This is the standard web → dot-matrix solution and
works whether the app is hosted remotely or locally (QZ ships a trusted
`localhost` certificate, so an HTTPS page can reach `wss://localhost`).

**Community / unsigned** QZ is used — no certificate infrastructure. QZ shows a
one-time "Allow this site?" prompt (remember-able). Acceptable for one trusted
shop PC.

### Data flow

```
[Cetak Epson button]  (owner-only; sibling of Cetak PDF in DocumentButtons.tsx)
   -> freshData()               reuse getInvoiceData refetch (owner-gated, has prices)
   -> buildEscP(data)           new pure module -> ESC/P byte string
   -> qz-tray: connect wss://localhost, print RAW to saved printer name
   -> printer prints with its built-in font -> crisp text, no rasterization
```

The button lives inside `DocumentButtons`, which is already rendered only for
owners (`pesanan/[id]/page.tsx:158`, `{isOwner && invoiceData && ...}`), so
price data on the receipt inherits the existing owner gate. No new
authorization surface.

## Components

### 1. `src/lib/escp.ts` — ESC/P builder (pure, unit-tested)

`buildEscP(data: InvoiceData): string` returns the ESC/P command stream as a JS
string (control characters embedded, e.g. `\x1B@`). Pure function of its input
so it is fully testable without a browser or printer.

ESC/P command usage (9-pin LX-310):

- `ESC @` (`\x1B\x40`) — reset printer to defaults.
- `ESC C 33` (`\x1B\x43\x21`) — set page length to 33 lines (5.5″ at 6 LPI).
- 10 CPI / pica (printer default; `ESC P` if needed) → 80-column grid.
- **Bold used minimally**: only the shop name and the final `TOTAL` wrap in
  `ESC E` (`\x1B\x45`, on) / `ESC F` (`\x1B\x46`, off). Everything else is plain.
  Minimizing bold is the primary blur fix — double-strike is what smears.
- `\n` line feed; `\f` (`\x0C`) form-feed between pages **and** at the very end,
  so the next receipt starts on the next form's top edge (alignment).
- **No** images, gray, or background fills — pure text.

Layout (80 columns; column widths in characters):

```
NO QTY  NAMA BARANG                        HARGA(Rp)   JUMLAH(Rp)  CHECK
 3   4  34                                        12          12       8   = 78 cols
```

- Header block: shop name + address lines on the left; `Tgl. Pesanan` and
  `Tgl. Pengiriman` right-aligned — all kept **inside** the 80-column printable
  width so nothing clips (fixing the PDF's right-edge overflow). Customer
  `Kepada Yth` / name / address included, matching the PDF.
- Divider line.
- Table header row, then item rows. Numbers formatted with `formatNumberID`.
  Item names longer than the NAMA column **wrap** to a continuation line.
- Per-page `SUBTOTAL` (right-aligned).
- Footer: `Perhatian:` note text, `Penerima,` signature line, and `TOTAL`
  (bold) on the last page only — mirroring the PDF.
- **Pagination**: items are chunked to fit the per-page line budget; each page
  ends with a form-feed. Page structure (header + items + per-page subtotal +
  footer) mirrors the PDF's multi-page behavior.

### 2. `src/components/pesanan/DocumentButtons.tsx` — new button

- Add a **"Cetak Epson"** button next to "Cetak PDF", with its own
  `epsonLoading` state (independent of `pdfLoading`).
- `handleEpsonPrint`:
  1. If no saved printer name → error: *"Atur nama printer Epson di
     Pengaturan."*
  2. Dynamically `import('qz-tray')` and `import('@/lib/escp')` in the handler
     (client-only; follows the codebase's dynamic-import rule for browser-only
     libs).
  3. `freshData()` (reuse existing refetch) → `buildEscP(data)`.
  4. Connect QZ (`qz.websocket.connect()` if not already active). If it fails →
     error: *"QZ Tray tidak berjalan. Jalankan QZ Tray di PC."*
  5. `qz.configs.create(printerName)`; `qz.print(config, [{ type: 'raw',
     format: 'command', flavor: 'plain', data: escpString }])`.
  6. Surface success/failure with the existing `error` line pattern; Indonesian
     copy.
- The saved printer name is passed in as a new prop `epsonPrinterName?: string`.

### 3. Printer-name setting

- New `settings` row: key `epson_printer_name`, text value (empty until set).
- **Pengaturan** gains an owner-only section to save the printer name, with a
  **"Deteksi Printer"** helper that calls `qz.printers.find()` and lists
  installed printers to pick from (avoids exact-name typos — the #1 QZ failure
  mode). Manual text entry is also allowed as a fallback.
- New owner-only Server Action `updateEpsonPrinterName(name: string)` following
  the existing settings-write pattern (owner check via `requireOwner`; every
  export in a `'use server'` file is `async`). Fail-closed reads consistent with
  the existing `pesanan_locked` handling.
- `epson_printer_name` is read server-side (server client, not admin) and passed
  down: `pengaturan/page.tsx` for the editor, and `pesanan/[id]/page.tsx` →
  `DocumentButtons` for the print button.

### 4. Dependency

- Add `qz-tray` (npm). Client-only; imported dynamically inside handlers, never
  at module top level or into a Server Component.

## Error handling

| Condition | Behavior |
|---|---|
| Printer name not set | Block; message pointing to Pengaturan. |
| QZ Tray not running / connect fails | Block; message to start QZ Tray. |
| Print call rejects | Show generic *"Gagal mencetak ke Epson."* |
| `getInvoiceData` refetch fails | Fall back to the render-time `data` prop (same as the PDF flow). |

## Testing

- **Vitest unit tests for `buildEscP`** (pure, no browser/printer):
  - Emits the reset/init sequence (`ESC @`, page length).
  - Column alignment for a representative multi-item order (assert fixed-width
    positions / a text snapshot of the printable portion).
  - Number formatting via `formatNumberID`.
  - Multi-page order produces the correct number of form-feeds / pages.
  - Stream ends with a trailing form-feed.
- **Manual test checklist** (QZ + hardware, cannot be unit-tested): install QZ
  Tray, set printer name via Deteksi, print a short and a long (multi-page)
  order, confirm crisp text, no right-edge clipping, correct top-of-form
  alignment on the next slip.

## One-time shop setup (documented for the user, not code)

1. Install QZ Tray on the Windows PC; allow the site on first print.
2. In Pengaturan → set the Epson printer name (use Deteksi).
3. Set the Windows printer form/page size to **9.5 × 5.5 inch**.

## Out of scope / future

- Signed QZ certificate for fully silent printing.
- A "Tes Cetak" button in Pengaturan.
- Printing a graphical logo on the Epson.
