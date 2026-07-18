# Owner/Helper Visibility, PDF, and Price-Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict tanggal pengiriman and customer phone to owners, rework the pesanan PDF for print readability and per-page completeness, and add dot-grouped thousands separators to owner price inputs.

**Architecture:** Pure app-layer UI + shared-helper changes. Role gating uses the existing `isOwner` flags already present in the affected components. Number formatting is centralized in `src/lib/utils.ts`. No DB/schema/RLS changes.

**Tech Stack:** Next.js (App Router, remote-only Supabase), React, `@react-pdf/renderer`, Base-UI shadcn, Vitest.

## Global Constraints

- **Indonesian dot grouping** for all thousands separators (`toLocaleString('id-ID')`), never commas.
- **`'use server'` files: every export must be `async`** — but no Server Action signatures change here.
- **Every UI change must be checked at a mobile viewport too**, not just desktop.
- **PDF horizontal page padding (`paddingHorizontal: 48`) must stay unchanged.**
- **`type="number"` inputs store raw strings in state**, parsed only at save time (existing convention).
- Verification gate for the whole plan: `npm run build` AND `npm run test:run` must pass.

---

### Task 1: Shared number-format helpers

**Files:**
- Modify: `src/lib/utils.ts`
- Test: `src/lib/utils.test.ts`

**Interfaces:**
- Produces:
  - `formatNumberID(amount: number): string` — dot-grouped, no `Rp` prefix.
  - `formatThousandsInput(raw: string): string` — raw user text → dot-grouped display of its digits.
  - `parseThousandsInput(display: string): string` — any string → digits only (`""` if none).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/utils.test.ts` (keep existing imports; add these names to the existing `import { ... } from './utils'` line):

```ts
import { formatNumberID, formatThousandsInput, parseThousandsInput } from './utils'

describe('formatNumberID', () => {
  it('groups thousands with dots and no Rp', () => {
    expect(formatNumberID(1000000)).toBe('1.000.000')
    expect(formatNumberID(0)).toBe('0')
    expect(formatNumberID(1500)).toBe('1.500')
  })
})

describe('parseThousandsInput', () => {
  it('keeps only digits', () => {
    expect(parseThousandsInput('1.000.000')).toBe('1000000')
    expect(parseThousandsInput('Rp 2.500a')).toBe('2500')
    expect(parseThousandsInput('')).toBe('')
  })
})

describe('formatThousandsInput', () => {
  it('formats digit runs with dot grouping', () => {
    expect(formatThousandsInput('1000000')).toBe('1.000.000')
    expect(formatThousandsInput('1.000')).toBe('1.000')
    expect(formatThousandsInput('')).toBe('')
    expect(formatThousandsInput('0')).toBe('0')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/utils.test.ts`
Expected: FAIL — `formatNumberID`/`parseThousandsInput`/`formatThousandsInput` not exported.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/utils.ts`:

```ts
/** Dot-grouped Indonesian number, no currency prefix (e.g. 1000000 -> "1.000.000"). */
export function formatNumberID(amount: number): string {
  return amount.toLocaleString('id-ID')
}

/** Strip everything but digits (e.g. "Rp 1.000a" -> "1000", "" -> ""). */
export function parseThousandsInput(display: string): string {
  return display.replace(/\D/g, '')
}

/** Format raw user input as dot-grouped digits for display (e.g. "1000000" -> "1.000.000"). */
export function formatThousandsInput(raw: string): string {
  const digits = parseThousandsInput(raw)
  if (digits === '') return ''
  return Number(digits).toLocaleString('id-ID')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: add number-format helpers for PDF and price inputs"
```

---

### Task 2: Tanggal pengiriman → owner-only everywhere

**Files:**
- Modify: `src/app/(app)/pesanan/[id]/page.tsx` (the "Tgl. Pengiriman" block, ~lines 138-152)
- Modify: `src/components/pesanan/OrderList.tsx` (desktop `<th>`/`<td>` ~lines 185, 221-225; mobile card ~lines 164-169)

**Interfaces:**
- Consumes: existing `isOwner` boolean in both files (already in scope).

- [ ] **Step 1: Gate the detail-page block**

In `src/app/(app)/pesanan/[id]/page.tsx`, replace the whole delivery-date `<div className="flex items-center gap-2 mt-1.5"> … </div>` block (the label span + the `isOwner ? <TanggalPengirimanEditor…/> : <span>…</span>` ternary) with an owner-only version — helpers see nothing:

```tsx
{isOwner && (
  <div className="flex items-center gap-2 mt-1.5">
    <span className="text-xs text-muted-foreground">Tgl. Pengiriman:</span>
    <TanggalPengirimanEditor
      pesananId={pesanan.id}
      initialValue={pesanan.tanggal_pengiriman}
    />
  </div>
)}
```

- [ ] **Step 2: Gate the OrderList desktop column**

In `src/components/pesanan/OrderList.tsx`, wrap the header cell:

```tsx
{isOwner && <th className="text-left px-4 py-3 font-medium">Tgl. Pengiriman</th>}
```

and the matching body cell (currently the `<td className="px-4 py-3 text-muted-foreground">` rendering `p.tanggal_pengiriman`):

```tsx
{isOwner && (
  <td className="px-4 py-3 text-muted-foreground">
    {p.tanggal_pengiriman
      ? format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', { locale: idLocale })
      : <span className="text-xs italic">Belum ditentukan</span>}
  </td>
)}
```

- [ ] **Step 3: Gate the OrderList mobile card line**

Wrap the mobile "Pengiriman:" paragraph:

```tsx
{isOwner && (
  <p className="text-xs text-muted-foreground mt-1">
    <span className="font-medium">Pengiriman:</span>{' '}
    {p.tanggal_pengiriman
      ? format(new Date(p.tanggal_pengiriman), 'd MMM yyyy', { locale: idLocale })
      : 'Belum ditentukan'}
  </p>
)}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds. Confirm the desktop table column count still aligns (header and body cells are both gated by the same `isOwner`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/pesanan/[id]/page.tsx" src/components/pesanan/OrderList.tsx
git commit -m "feat: restrict tanggal pengiriman to owner accounts"
```

---

### Task 3: Hide customer phone from helpers

**Files:**
- Modify: `src/app/(app)/pesanan/[id]/page.tsx` (the `pelanggan.telepon` paragraph, ~lines 172-174)

**Interfaces:**
- Consumes: existing `isOwner` boolean.

- [ ] **Step 1: Gate the phone line**

Replace the telepon paragraph with an owner-gated version:

```tsx
{isOwner && pesanan.pelanggan?.telepon && (
  <p className="text-sm text-muted-foreground">{pesanan.pelanggan.telepon}</p>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/pesanan/[id]/page.tsx"
git commit -m "feat: hide customer phone number from helper accounts"
```

---

### Task 4: Pesanan PDF rework

**Files:**
- Modify: `src/components/invoice/DocumentPDF.tsx`

**Interfaces:**
- Consumes: `formatNumberID` from `@/lib/utils` (Task 1).

- [ ] **Step 1: Import the plain number formatter**

At the top of `src/components/invoice/DocumentPDF.tsx`, change the utils import to bring in `formatNumberID` (drop `formatRupiah` if it becomes unused after this task):

```tsx
import { formatNumberID } from '@/lib/utils'
```

- [ ] **Step 2: Set 12 items per page**

```tsx
const ITEMS_PER_PAGE = 12
```

- [ ] **Step 3: Enlarge fonts (keep horizontal padding at 48)**

In the `styles` object, bump sizes for readability while leaving `paddingHorizontal: 48` untouched. Apply these values:

```tsx
page: {
  paddingTop: 15,
  paddingHorizontal: 48,   // unchanged
  paddingBottom: 40,
  fontSize: 11,            // was 9
  fontFamily: 'Helvetica',
  color: '#1a1a1a',
},
```

Then raise the proportional sizes: `logoAU` 24→28, `logoElectronic` 11→13, `logoSpareParts` 8→9, `logoAddress` 7→9, `metaDate` 9→11, `kepadaLabel` 8→10, `kepadaName` 10→12, `kepadaAlamat` 8→10, `tableHeader`/`tableRow` inherit the base 11, `pageSubtotalLabel`/`pageSubtotalValue` 9→11, `perhatianTitle` 8→10, `perhatianText` 7.5→9.5, `totalLabel`/`totalValue` 12→15. Increase `crownImage` to `{ width: 38, height: 56 }`. Widen the numeric columns to fit larger digits: `colQty` width 50→56, `colHarga` width 90→104, `colSubtotal` width 90→104, `pageSubtotalValue` width 90→104.

- [ ] **Step 4: Bold the customer address**

In `styles.kepadaAlamat`, add the bold font family:

```tsx
kepadaAlamat: { fontSize: 10, color: '#444', fontFamily: 'Helvetica-Bold' },
```

- [ ] **Step 5: Uppercase + Rp-in-header for the table**

In `PageHeader`, change the `tableHeader` labels to uppercase with `(Rp)` on the money columns:

```tsx
<View style={styles.tableHeader}>
  <Text style={styles.colNo}>NO</Text>
  <Text style={styles.colQty}>QTY</Text>
  <Text style={styles.colNama}>NAMA BARANG</Text>
  <Text style={styles.colHarga}>HARGA SATUAN (Rp)</Text>
  <Text style={styles.colSubtotal}>JUMLAH (Rp)</Text>
</View>
```

In the item row map, uppercase the item name and drop `Rp` from the numbers:

```tsx
{pageItems.map((item, i) => (
  <View key={i} style={styles.tableRow}>
    <Text style={styles.colNo}>{startIndex + i + 1}</Text>
    <Text style={styles.colQty}>{item.qty}</Text>
    <Text style={styles.colNama}>{item.namaBarang.toUpperCase()}</Text>
    <Text style={styles.colHarga}>{formatNumberID(item.hargaSatuan)}</Text>
    <Text style={styles.colSubtotal}>{formatNumberID(item.subtotal)}</Text>
  </View>
))}
```

Update the per-page subtotal (label uppercased, value without Rp):

```tsx
<View style={styles.pageSubtotalRow}>
  <Text style={styles.pageSubtotalLabel}>SUBTOTAL</Text>
  <Text style={styles.pageSubtotalValue}>{formatNumberID(pageSubtotal)}</Text>
</View>
```

- [ ] **Step 6: Signature on every page, Total on last page only, Rp dropped**

Replace the `bottomSection` block so the signature block is outside the `isLastPage` guard and only `totalArea` stays inside it; uppercase the `TOTAL` label and drop `Rp`:

```tsx
<View style={styles.bottomSection} wrap={false}>
  <View style={styles.perhatianBox}>
    <Text style={styles.perhatianTitle}>Perhatian:</Text>
    <Text style={styles.perhatianText}>
      Barang yang sudah dibeli, tidak bisa ditukar / dikembalikan, kecuali sesuai perjanjian.
    </Text>
  </View>
  <View style={styles.signatureBlock}>
    <View style={styles.signatureLine} />
    <Text>Penerima,</Text>
  </View>
  {isLastPage && (
    <View style={styles.totalArea}>
      <Text style={styles.totalLabel}>TOTAL</Text>
      <Text style={styles.totalValue}>{formatNumberID(data.totalPesanan)}</Text>
    </View>
  )}
</View>
```

Note: keep `totalArea` with `minWidth: 110` so non-last pages (which omit it) still leave the signature block centered reasonably. If the signature looks off-center on non-last pages, add `{!isLastPage && <View style={{ minWidth: 110 }} />}` as a spacer — decide during the visual check in Step 8.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds; no unused-import lint error (remove `formatRupiah` import if now unused).

- [ ] **Step 8: Visual render check**

Run the dev server (`npm run dev`), open an order with 13+ items as owner, and generate the PDF. Confirm: 12 items per page, perhatian + signature on every page, grand total on the last page only, larger readable fonts, uppercase table, no `Rp` in cells, `Rp` only in headers, bold address, and 12 rows + footer fit A5 landscape without overflow. Adjust row `paddingVertical` down (e.g. 2→1.5) only if overflow appears — do not touch `paddingHorizontal`.

- [ ] **Step 9: Commit**

```bash
git add src/components/invoice/DocumentPDF.tsx
git commit -m "feat: rework pesanan PDF (12/page, per-page footer, larger caps, Rp in headers)"
```

---

### Task 5: Owner price inputs with dot separators

**Files:**
- Modify: `src/components/pesanan/BulkPriceForm.tsx`
- Modify: `src/components/pesanan/PaymentModal.tsx`

**Interfaces:**
- Consumes: `formatThousandsInput`, `parseThousandsInput` from `@/lib/utils` (Task 1).

- [ ] **Step 1: BulkPriceForm — format state on display, parse on save**

In `src/components/pesanan/BulkPriceForm.tsx`:

Import the helpers (extend the existing utils import):

```tsx
import { formatRupiah, formatThousandsInput, parseThousandsInput } from '@/lib/utils'
```

Keep the existing raw-digit state model, but store parsed digits and render formatted. In `setField`, normalize to digits before storing:

```tsx
function setField(id: string, field: 'harga_satuan', value: string) {
  setPrices((prev) => ({ ...prev, [id]: { ...prev[id], [field]: parseThousandsInput(value) } }))
  setSaved(false)
}
```

Change BOTH Harga Satuan inputs (mobile ~line 82 and desktop ~line 119) from `type="number" min="0"` to text with numeric keypad, and format the displayed value:

```tsx
<Input
  type="text"
  inputMode="numeric"
  value={formatThousandsInput(p?.harga_satuan ?? '')}
  onChange={(e) => setField(item.id, 'harga_satuan', e.target.value)}
  className="h-8 text-right font-mono text-sm"   // desktop keeps: className="h-8 w-36 ml-auto text-right font-mono text-sm" and aria-label
/>
```

The existing `parseInt(prices[i.id]?.harga_satuan || '0', 10)` in `handleSave` and the `parseInt(p?.harga_satuan || '0', 10)` subtotal/grandTotal calcs already work because state now holds pure digits — no change needed there.

- [ ] **Step 2: PaymentModal — controlled formatted field + hidden raw value**

In `src/components/pesanan/PaymentModal.tsx`:

Import helpers and seed raw state from `sisaTagihan`:

```tsx
import { formatThousandsInput, parseThousandsInput } from '@/lib/utils'
```

Add state inside the component (near the other `useState` calls):

```tsx
const [jumlahRaw, setJumlahRaw] = useState(String(sisaTagihan > 0 ? sisaTagihan : ''))
```

Replace the Jumlah `<Input>` with a formatted, controlled text field (no `name`) plus a hidden field carrying the raw digits that `createPembayaran` reads via `Number(formData.get('jumlah'))`:

```tsx
<Input
  id="jumlah"
  type="text"
  inputMode="numeric"
  value={formatThousandsInput(jumlahRaw)}
  onChange={(e) => setJumlahRaw(parseThousandsInput(e.target.value))}
  required
/>
<input type="hidden" name="jumlah" value={jumlahRaw} />
```

- [ ] **Step 3: Build + tests**

Run: `npm run build && npm run test:run`
Expected: both pass.

- [ ] **Step 4: Manual check (desktop + mobile)**

As owner: type in a Harga Satuan field — digits group with dots live; subtotal/total update correctly; save persists. Open the payment modal — the Jumlah field shows the dot-grouped remaining balance, editing regroups live, and saving records the correct amount. Verify on a narrow (mobile) viewport too.

- [ ] **Step 5: Commit**

```bash
git add src/components/pesanan/BulkPriceForm.tsx src/components/pesanan/PaymentModal.tsx
git commit -m "feat: dot-grouped thousands separators in owner price inputs"
```

---

## Self-Review Notes

- **Spec coverage:** (1) tanggal pengiriman → Task 2; (2) PDF 12/page + per-page footer + fonts + caps + Rp-in-header + bold address → Task 4; (3) phone hidden → Task 3; (4) price separators (harga satuan + payment) → Task 5; shared helpers → Task 1. All covered.
- **Type consistency:** helper names `formatNumberID` / `formatThousandsInput` / `parseThousandsInput` used identically in Tasks 4 and 5 as defined in Task 1.
- **Constraints honored:** dot grouping only; `paddingHorizontal: 48` untouched; state holds raw digit strings; mobile checks included.
