# Checklist UI fixes + Realtime data refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UI issues on the pesanan detail page's item checklist (ambiguous Reset controls, a layout bug when the price editor expands, and a broken font variable causing a serif fallback app-wide), then add silent realtime auto-refresh to the five data-bearing pages so changes made by one user/tab appear for others without a manual reload.

**Architecture:** UI fixes are isolated edits to `pesanan/[id]/page.tsx`, `ResetChecklistButton.tsx`, and `globals.css`. Realtime refresh is a DB migration (one new column + three triggers + a publication change) plus a reusable client hook/component that subscribes to Supabase Realtime `postgres_changes` on the `pesanan` table only (never `item_pesanan`/`pembayaran` directly, to avoid leaking price/payment columns to helper browsers) and calls `router.refresh()` on any event, so the existing role-aware server queries remain the single source of truth.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (Postgres + Realtime, remote-only via MCP tools), Base UI (`@base-ui/react`) via shadcn `base-nova` style, Tailwind v4, Vitest + Testing Library.

## Global Constraints

- Supabase is remote-only (ref `pjkddahrjjqblexxhaef`, region ap-southeast-1) — schema changes go via the Supabase MCP tools (`apply_migration`, `execute_sql`), not a local CLI.
- `item_pesanan` and `pembayaran` contain price/payment columns that must never be sent to a helper's browser. `postgres_changes` payloads carry full row data gated only by RLS row-visibility, not column-visibility — so realtime subscriptions must target `pesanan` (which has no price/payment columns) and never `item_pesanan`/`pembayaran` directly.
- `'use server'` files: every export must be `async` — run `npm run build` before considering any Server Action change done.
- shadcn here uses Base UI, not Radix: composed components take `render={<Button .../>}` instead of `asChild`.
- Every UI change must be checked at a mobile viewport width too, not just desktop.

---

### Task 1: Fix broken `--font-sans` variable and bump base readability

**Files:**
- Modify: `src/app/globals.css:7-12,120-130`

**Interfaces:** None (pure CSS, no exports consumed by other tasks).

**Context:** `src/app/layout.tsx` injects Geist Sans via `next/font/google` as CSS variable `--font-geist-sans` on `<html>`. But `globals.css`'s `@theme inline` block defines `--font-sans: var(--font-sans);` — a self-reference. A custom property that references itself resolves to its "guaranteed-invalid value", so `html { @apply font-sans; }` (which expands to `font-family: var(--font-sans)`) silently falls back to the browser's default UA font-family for `<html>`, which is typically a serif font. This is why the app currently renders in a serif typeface instead of Geist Sans — it's a bug, not a deliberate choice.

- [ ] **Step 1: Fix the variable and bump the base size**

In `src/app/globals.css`, change:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
```

to:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
```

And change:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

to:

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
    font-size: 17px;
  }
}
```

`font-size: 17px` on `html` scales every Tailwind rem-based utility (`text-xs`, `text-sm`, `text-base`, etc.) proportionally across the whole app (~6% larger), improving readability everywhere without rewriting every component's classes.

- [ ] **Step 2: Verify visually**

Run: `npm run dev`

Open `http://localhost:3000/pesanan` (or any page) in a browser. Confirm:
- Text renders in a clean sans-serif typeface (Geist Sans), not a serif font.
- Body text is noticeably larger/more readable than before.

This is a CSS-only change with no automated test coverage in this repo (no visual regression tooling configured) — the dev-server check above is the verification.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "fix: resolve self-referencing --font-sans variable, bump base font size"
```

---

### Task 2: Fix table row layout when the price editor expands (owner view)

**Files:**
- Modify: `src/app/(app)/pesanan/[id]/page.tsx:230-271`

**Interfaces:** None — pure JSX/className change, no new props or exports.

**Context:** In the owner's desktop item table, clicking the pencil icon next to a price opens `ItemPriceEditor`'s inline edit form inside the `<td>`. That makes the row much taller. Table cells default to `vertical-align: middle`, so the other cells in that same row (Nama Barang, Qty, the two checklist checkboxes) re-center vertically inside the now-tall row, leaving large empty gaps above and below their content — a layout bug, reproducible by opening any item's price editor on `/pesanan/[id]` as the owner.

- [ ] **Step 1: Add `align-top` to every cell in the items table**

In `src/app/(app)/pesanan/[id]/page.tsx`, replace the `<tbody>` block:

```tsx
            <tbody className="divide-y">
              {pesanan.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2">{item.nama_barang}</td>
                  <td className="px-4 py-2 text-right">{item.qty}</td>
                  <td className="px-4 py-2">
                    <ItemChecklistCheckbox
                      itemId={item.id}
                      pesananId={pesanan.id}
                      checked={item.diambil_oleh_helper}
                      kind="helper"
                      label="Diambil"
                    />
                  </td>
                  {isOwner && (
                    <td className="px-4 py-2">
                      <ItemChecklistCheckbox
                        itemId={item.id}
                        pesananId={pesanan.id}
                        checked={(item as OwnerItem).dicek_oleh_owner}
                        kind="owner"
                        label="Dicek"
                      />
                    </td>
                  )}
                  {isOwner && (
                    <td className="px-4 py-2 text-right">
                      <ItemPriceEditor
                        itemId={item.id}
                        pesananId={pesanan.id}
                        hargaSatuan={(item as OwnerItem).harga_satuan}
                        diskon={(item as OwnerItem).diskon}
                      />
                    </td>
                  )}
                  {isOwner && (
                    <td className="px-4 py-2 text-right font-mono">
                      {formatRupiah((item as OwnerItem).subtotal)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
```

with:

```tsx
            <tbody className="divide-y">
              {pesanan.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 align-top">{item.nama_barang}</td>
                  <td className="px-4 py-2 text-right align-top">{item.qty}</td>
                  <td className="px-4 py-2 align-top">
                    <ItemChecklistCheckbox
                      itemId={item.id}
                      pesananId={pesanan.id}
                      checked={item.diambil_oleh_helper}
                      kind="helper"
                      label="Diambil"
                    />
                  </td>
                  {isOwner && (
                    <td className="px-4 py-2 align-top">
                      <ItemChecklistCheckbox
                        itemId={item.id}
                        pesananId={pesanan.id}
                        checked={(item as OwnerItem).dicek_oleh_owner}
                        kind="owner"
                        label="Dicek"
                      />
                    </td>
                  )}
                  {isOwner && (
                    <td className="px-4 py-2 text-right align-top">
                      <ItemPriceEditor
                        itemId={item.id}
                        pesananId={pesanan.id}
                        hargaSatuan={(item as OwnerItem).harga_satuan}
                        diskon={(item as OwnerItem).diskon}
                      />
                    </td>
                  )}
                  {isOwner && (
                    <td className="px-4 py-2 text-right font-mono align-top">
                      {formatRupiah((item as OwnerItem).subtotal)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`, log in as an owner, open an existing pesanan detail page, click the pencil icon on any item's price. Confirm the Nama Barang/Qty/checkbox cells now stay anchored to the top of the row instead of floating in the vertical middle of the expanded row.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/pesanan/[id]/page.tsx"
git commit -m "fix: anchor item table cells to top so price editor doesn't misalign the row"
```

---

### Task 3: Disambiguate Reset buttons and replace window.confirm with an AlertDialog overlay

**Files:**
- Modify: `src/components/pesanan/ResetChecklistButton.tsx` (full rewrite)
- Modify: `src/app/(app)/pesanan/[id]/page.tsx:144-170` (call sites + summary row layout)
- Create: `src/components/ui/alert-dialog.tsx` (already generated via `npx shadcn@latest add alert-dialog` — verify it exists; if not, run that command)

**Interfaces:**
- Produces: `ResetChecklistButton` now takes `{ pesananId: string; target: 'helper' | 'owner'; label: string; confirmTitle: string; confirmDescription: string }` (previously `{ pesananId, target, confirmLabel }`).

**Context:** Today there are two adjacent buttons both labeled plain "Reset", spread to opposite ends of a row by `justify-between`, with no visual association to which checklist each one clears — confirmed in `owner-desktop-detail.png` showing "Reset ... 0/1 dicek pemilik ... Reset" with no indication which button does what. Confirmation currently uses `window.confirm()`, a native browser dialog the user wants replaced with an in-app overlay. `src/components/ui/alert-dialog.tsx` already exists in this repo (Base UI-based, generated via shadcn) with `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` exported. Note `AlertDialogAction` here is a plain styled `Button` (not a Base UI primitive) — it does **not** auto-close the dialog, so the consumer must close it explicitly after the action succeeds (mirroring the existing `confirmLabel`/loading/error handling already in this component).

- [ ] **Step 1: Confirm the alert-dialog component exists**

Run: `ls src/components/ui/alert-dialog.tsx`
Expected: file exists. If missing, run `npx shadcn@latest add alert-dialog --yes` first.

- [ ] **Step 2: Rewrite `ResetChecklistButton.tsx`**

Replace the full contents of `src/components/pesanan/ResetChecklistButton.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { resetChecklist } from '@/app/(app)/pesanan/actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ResetChecklistButtonProps {
  pesananId: string
  target: 'helper' | 'owner'
  label: string
  confirmTitle: string
  confirmDescription: string
}

export function ResetChecklistButton({
  pesananId,
  target,
  label,
  confirmTitle,
  confirmDescription,
}: ResetChecklistButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setLoading(true)
    setError(null)
    const result = await resetChecklist(pesananId, target)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    setLoading(false)
    setOpen(false)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
          {label}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={loading}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  )
}
```

- [ ] **Step 3: Update the call sites and pair each Reset with its own count**

In `src/app/(app)/pesanan/[id]/page.tsx`, replace:

```tsx
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium">Item Pesanan</h3>
          <span className="text-sm text-muted-foreground">
            {diambilCount}/{totalItems} diambil dari etalase
          </span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
          <ResetChecklistButton
            pesananId={pesanan.id}
            target="helper"
            confirmLabel="Kosongkan checklist pengambilan? Semua tanda centang akan dihapus."
          />
          {isOwner && (
            <span className="text-muted-foreground">
              {dicekCount}/{totalItems} dicek pemilik
            </span>
          )}
          {isOwner && (
            <ResetChecklistButton
              pesananId={pesanan.id}
              target="owner"
              confirmLabel="Kosongkan checklist pemeriksaan pemilik? Semua tanda centang akan dihapus."
            />
          )}
        </div>
```

with:

```tsx
      <div className="space-y-3">
        <h3 className="font-medium">Item Pesanan</h3>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {diambilCount}/{totalItems} diambil dari etalase
            </span>
            <ResetChecklistButton
              pesananId={pesanan.id}
              target="helper"
              label="Reset Diambil"
              confirmTitle="Reset checklist pengambilan?"
              confirmDescription="Semua tanda centang pengambilan dari etalase akan dihapus."
            />
          </div>
          {isOwner && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {dicekCount}/{totalItems} dicek pemilik
              </span>
              <ResetChecklistButton
                pesananId={pesanan.id}
                target="owner"
                label="Reset Dicek"
                confirmTitle="Reset checklist pemeriksaan pemilik?"
                confirmDescription="Semua tanda centang pemeriksaan pemilik akan dihapus."
              />
            </div>
          )}
        </div>
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: succeeds with no type errors (the renamed `ResetChecklistButton` props must match at both call sites).

Run: `npm run dev`, open `/pesanan/[id]` as owner on both desktop and a mobile viewport width. Click "Reset Diambil" and "Reset Dicek" — confirm an in-app dialog appears (not the browser's native `confirm()`), each labeled with which checklist it clears, with working Batal/Reset buttons.

- [ ] **Step 5: Commit**

```bash
git add src/components/pesanan/ResetChecklistButton.tsx "src/app/(app)/pesanan/[id]/page.tsx" src/components/ui/alert-dialog.tsx
git commit -m "feat: replace window.confirm with AlertDialog overlay, clarify Reset button labels"
```

---

### Task 4: Migration — add `pesanan.updated_at` and cascade triggers, enable Realtime publication

**Files:**
- Create (record only): `supabase/migrations/<timestamp>_pesanan_updated_at_and_realtime.sql`
- Modify: `src/lib/types.ts` (`Pesanan` interface — add `updated_at: string`)

**Interfaces:**
- Produces: `pesanan.updated_at` column, kept current by triggers; `pesanan`, `pelanggan`, `users` are now members of the `supabase_realtime` publication, which Task 5/7 depend on for `postgres_changes` to fire at all.

**Context:** Per CLAUDE.md, Supabase here is remote-only — apply this via the Supabase MCP `apply_migration` tool against project ref `pjkddahrjjqblexxhaef`, not a local CLI. Confirmed via `list_publication_tables` query that `supabase_realtime` currently has zero tables, so no realtime events fire today regardless of subscriptions. `pesanan` has no price/payment columns (confirmed via schema inspection), so it's safe for both owner and helper roles to receive its row events directly — but `item_pesanan` and `pembayaran` are not safe to subscribe to directly (see Global Constraints), hence cascading their changes into a `pesanan.updated_at` bump instead of subscribing to them.

- [ ] **Step 1: Apply the migration via the Supabase MCP tool**

Call the `apply_migration` MCP tool with:
- `project_id`: `pjkddahrjjqblexxhaef`
- `name`: `pesanan_updated_at_and_realtime`
- `query`:

```sql
-- 1. Add updated_at to pesanan, defaulting existing rows to created_at.
alter table public.pesanan add column updated_at timestamptz not null default now();

-- The pesanan_write_guard trigger rejects updates to non-draft pesanan from
-- a non-owner session; migrations run without a real auth session, so the
-- backfill below must run with that guard disabled (same pattern as the
-- existing kode_pesanan backfill in this codebase).
alter table public.pesanan disable trigger pesanan_write_guard;
update public.pesanan set updated_at = created_at;
alter table public.pesanan enable trigger pesanan_write_guard;

-- 2. Bump updated_at on any direct edit to pesanan itself.
create or replace function public.set_pesanan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pesanan_set_updated_at
before update on public.pesanan
for each row
execute function public.set_pesanan_updated_at();

-- 3. Cascade item_pesanan changes into the parent pesanan's updated_at.
create or replace function public.bump_pesanan_updated_at_from_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pesanan
  set updated_at = now()
  where id = coalesce(new.pesanan_id, old.pesanan_id);
  return coalesce(new, old);
end;
$$;

create trigger item_pesanan_bump_pesanan
after insert or update or delete on public.item_pesanan
for each row
execute function public.bump_pesanan_updated_at_from_item();

-- 4. Cascade pembayaran changes into the parent pesanan's updated_at.
create or replace function public.bump_pesanan_updated_at_from_pembayaran()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pesanan
  set updated_at = now()
  where id = coalesce(new.pesanan_id, old.pesanan_id);
  return coalesce(new, old);
end;
$$;

create trigger pembayaran_bump_pesanan
after insert or update or delete on public.pembayaran
for each row
execute function public.bump_pesanan_updated_at_from_pembayaran();

-- 5. Enable Realtime for the tables the client will subscribe to.
alter publication supabase_realtime add table public.pesanan, public.pelanggan, public.users;
```

The cascade trigger functions are `security definer` because they write to `pesanan` from a trigger fired on `item_pesanan`/`pembayaran` — the invoking role (helper, toggling a checkbox) may not have direct UPDATE rights on `pesanan.updated_at` otherwise; `security definer` lets the trigger function run with the privileges of its owner instead. This mirrors the existing `kode_pesanan`-sequence pattern already used in this codebase for the same reason.

- [ ] **Step 2: Verify the migration**

Call the `execute_sql` MCP tool with `project_id`: `pjkddahrjjqblexxhaef` and:

```sql
select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime';
```

Expected: rows for `public.pesanan`, `public.pelanggan`, `public.users`.

Then:

```sql
select id, updated_at from public.pesanan limit 1;
```

Expected: a non-null `updated_at` value.

- [ ] **Step 3: Add the column to the TypeScript type**

In `src/lib/types.ts`, in the `Pesanan` interface, add `updated_at: string` alongside `created_at: string`:

```ts
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
```

- [ ] **Step 4: Record the migration and commit**

```bash
mkdir -p supabase/migrations
```

Save the exact SQL from Step 1 to `supabase/migrations/<YYYYMMDDHHMMSS>_pesanan_updated_at_and_realtime.sql` (use the current UTC timestamp as the filename prefix, matching the existing files in that directory), then:

```bash
git add supabase/migrations src/lib/types.ts
git commit -m "feat: add pesanan.updated_at with cascade triggers, enable Realtime publication"
```

---

### Task 5: `useRealtimeRefresh` hook

**Files:**
- Create: `src/hooks/use-realtime-refresh.ts`
- Test: `src/hooks/use-realtime-refresh.test.ts`

**Interfaces:**
- Produces: `useRealtimeRefresh(table: string, filter?: { column: string; value: string }): void` — subscribes to Supabase Realtime `postgres_changes` (`event: '*'`) on `table` (optionally filtered to `${filter.column}=eq.${filter.value}`), debounces 300ms, calls `router.refresh()`. Cleans up its channel on unmount. Task 6 consumes this exact signature.
- Consumes: `createClient` from `@/lib/supabase/client` (existing, no changes needed).

- [ ] **Step 1: Write the failing test**

Create `src/hooks/use-realtime-refresh.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRealtimeRefresh } from './use-realtime-refresh'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

let capturedCallback: (() => void) | null = null
const removeChannel = vi.fn()
const subscribe = vi.fn()
const on = vi.fn((_event: string, _config: unknown, callback: () => void) => {
  capturedCallback = callback
  return { subscribe }
})
const channel = vi.fn(() => ({ on }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ channel, removeChannel }),
}))

describe('useRealtimeRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refresh.mockClear()
    channel.mockClear()
    on.mockClear()
    subscribe.mockClear()
    removeChannel.mockClear()
    capturedCallback = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('subscribes to postgres_changes for the given table', () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    expect(channel).toHaveBeenCalledWith('pesanan-all')
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pesanan' },
      expect.any(Function)
    )
    expect(subscribe).toHaveBeenCalled()
  })

  it('applies a column filter when provided', () => {
    renderHook(() => useRealtimeRefresh('pesanan', { column: 'id', value: 'abc-123' }))
    expect(channel).toHaveBeenCalledWith('pesanan-id-abc-123')
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pesanan', filter: 'id=eq.abc-123' },
      expect.any(Function)
    )
  })

  it('debounces router.refresh by 300ms after a change event', () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    capturedCallback?.()
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(299)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('coalesces bursts of events into a single refresh', () => {
    renderHook(() => useRealtimeRefresh('pesanan'))
    capturedCallback?.()
    vi.advanceTimersByTime(100)
    capturedCallback?.()
    vi.advanceTimersByTime(100)
    capturedCallback?.()
    vi.advanceTimersByTime(300)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeRefresh('pesanan'))
    unmount()
    expect(removeChannel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/hooks/use-realtime-refresh.test.ts`
Expected: FAIL — `Cannot find module './use-realtime-refresh'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/hooks/use-realtime-refresh.ts`:

```ts
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RealtimeRefreshFilter {
  column: string
  value: string
}

export function useRealtimeRefresh(table: string, filter?: RealtimeRefreshFilter) {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channelName = filter ? `${table}-${filter.column}-${filter.value}` : `${table}-all`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        },
        () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(() => router.refresh(), 300)
        }
      )
      .subscribe()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      supabase.removeChannel(channel)
    }
  }, [table, filter?.column, filter?.value, router])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/hooks/use-realtime-refresh.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-realtime-refresh.ts src/hooks/use-realtime-refresh.test.ts
git commit -m "feat: add useRealtimeRefresh hook for Supabase Realtime-triggered router.refresh"
```

---

### Task 6: `RealtimeRefresh` component

**Files:**
- Create: `src/components/realtime/RealtimeRefresh.tsx`
- Test: `src/components/realtime/RealtimeRefresh.test.tsx`

**Interfaces:**
- Consumes: `useRealtimeRefresh(table, filter)` from Task 5 (exact signature above).
- Produces: `<RealtimeRefresh table={string} filter={{ column, value }}?  />` — a client component rendering nothing, for embedding inside Server Component pages (Task 7 depends on this).

- [ ] **Step 1: Write the failing test**

Create `src/components/realtime/RealtimeRefresh.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { RealtimeRefresh } from './RealtimeRefresh'

const useRealtimeRefresh = vi.fn()
vi.mock('@/hooks/use-realtime-refresh', () => ({
  useRealtimeRefresh: (...args: unknown[]) => useRealtimeRefresh(...args),
}))

describe('RealtimeRefresh', () => {
  it('calls useRealtimeRefresh with the given table and filter, and renders nothing', () => {
    const { container } = render(
      <RealtimeRefresh table="pesanan" filter={{ column: 'id', value: 'abc' }} />
    )
    expect(useRealtimeRefresh).toHaveBeenCalledWith('pesanan', { column: 'id', value: 'abc' })
    expect(container).toBeEmptyDOMElement()
  })

  it('works without a filter', () => {
    render(<RealtimeRefresh table="pelanggan" />)
    expect(useRealtimeRefresh).toHaveBeenCalledWith('pelanggan', undefined)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/realtime/RealtimeRefresh.test.tsx`
Expected: FAIL — `Cannot find module './RealtimeRefresh'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/realtime/RealtimeRefresh.tsx`:

```tsx
'use client'

import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'

interface RealtimeRefreshProps {
  table: string
  filter?: { column: string; value: string }
}

export function RealtimeRefresh({ table, filter }: RealtimeRefreshProps) {
  useRealtimeRefresh(table, filter)
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/realtime/RealtimeRefresh.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/realtime/RealtimeRefresh.tsx src/components/realtime/RealtimeRefresh.test.tsx
git commit -m "feat: add RealtimeRefresh wrapper component for Server Component pages"
```

---

### Task 7: Wire `RealtimeRefresh` into the five pages

**Files:**
- Modify: `src/app/(app)/pesanan/[id]/page.tsx`
- Modify: `src/app/(app)/pesanan/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/pelanggan/page.tsx`
- Modify: `src/app/(app)/pengaturan/page.tsx`

**Interfaces:**
- Consumes: `<RealtimeRefresh table={string} filter={{ column, value }}?  />` from Task 6.

- [ ] **Step 1: Wire the pesanan detail page**

In `src/app/(app)/pesanan/[id]/page.tsx`, add the import:

```tsx
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
```

Then render it as the first child inside the top-level `<div className="space-y-6 max-w-3xl">`, immediately before the `{/* Header */}` comment:

```tsx
    <div className="space-y-6 max-w-3xl">
      <RealtimeRefresh table="pesanan" filter={{ column: 'id', value: pesanan.id }} />
      {/* Header */}
```

- [ ] **Step 2: Wire the pesanan list page**

In `src/app/(app)/pesanan/page.tsx`, add the import:

```tsx
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
```

Render it as the first child inside `<div className="space-y-4">`:

```tsx
    <div className="space-y-4">
      <RealtimeRefresh table="pesanan" />
      <div className="flex items-center justify-between">
```

- [ ] **Step 3: Wire the dashboard page**

In `src/app/(app)/dashboard/page.tsx`, add the import:

```tsx
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
```

Render it as the first child inside `<div className="space-y-6">`:

```tsx
    <div className="space-y-6">
      <RealtimeRefresh table="pesanan" />
      <h2 className="text-lg font-semibold">Dashboard</h2>
```

- [ ] **Step 4: Wire the pelanggan list page**

In `src/app/(app)/pelanggan/page.tsx`, add the import:

```tsx
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
```

Render it as the first child inside `<div className="space-y-4">`:

```tsx
    <div className="space-y-4">
      <RealtimeRefresh table="pelanggan" />
      <div className="flex items-center justify-between">
```

- [ ] **Step 5: Wire the pengaturan page**

In `src/app/(app)/pengaturan/page.tsx`, add the import:

```tsx
import { RealtimeRefresh } from '@/components/realtime/RealtimeRefresh'
```

Render it as the first child inside `<div className="space-y-6">`:

```tsx
    <div className="space-y-6">
      <RealtimeRefresh table="users" />
      <div>
```

- [ ] **Step 6: Build and run unit tests**

Run: `npm run build`
Expected: succeeds (these are Server Components rendering a client component as a child — a standard, supported composition; no new Server Action exports were added).

Run: `npm run test:run`
Expected: all tests pass, including the Task 5/6 suites.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/pesanan/[id]/page.tsx" "src/app/(app)/pesanan/page.tsx" "src/app/(app)/dashboard/page.tsx" "src/app/(app)/pelanggan/page.tsx" "src/app/(app)/pengaturan/page.tsx"
git commit -m "feat: wire RealtimeRefresh into pesanan, dashboard, pelanggan, and pengaturan pages"
```

---

### Task 8: End-to-end verification

**Files:** None (verification only).

- [ ] **Step 1: Full automated check**

Run, in order:
```bash
npm run lint
npm run test:run
npm run build
```
Expected: all three succeed with no errors. `npm run build` is the only one of these that catches async-Server-Action mistakes, per this repo's CLAUDE.md.

- [ ] **Step 2: Manual two-session realtime check**

Run: `npm run dev`

Open the same `/pesanan/[id]` detail page in two separate browser sessions (e.g., two regular browser windows, or one regular + one incognito), logged in as the owner in both (or owner in one, helper in the other, to also confirm helpers never see price data appear via the realtime path). In session A, toggle an item's "Diambil" checkbox, toggle "Dicek", or edit a price. In session B, without reloading, confirm the change appears within roughly a second (debounce + Supabase Realtime round-trip). Repeat for the `/pesanan` list, `/dashboard`, `/pelanggan`, and `/pengaturan` pages with an analogous change (new pesanan, new pelanggan, new helper account).

If using the browser/devtools tooling available in this environment, this is also a good point to capture a couple of screenshots confirming the Task 1–3 UI fixes (Geist Sans font visibly applied, price-editor row no longer misaligned, AlertDialog overlay instead of a native confirm popup, distinct Reset Diambil/Reset Dicek labels).

- [ ] **Step 3: Confirm no regressions for helper price-masking**

While the helper session from Step 2 is open, open browser devtools' Network tab, filter for `realtime` (the websocket connection) or check the WS frames, and confirm no `harga_satuan`/`diskon`/`subtotal`/`jumlah` values ever appear in any frame received by the helper session — only `pesanan`-table fields (`id`, `kode_pesanan`, `status`, `catatan`, `updated_at`, etc.).
