# Realtime data refresh

## Problem

Pages don't reflect changes made by other users (or other tabs) until a manual reload. The user wants pesanan detail, pesanan list, dashboard, pelanggan list, and pengaturan to update automatically when the underlying data changes.

## Constraint

`item_pesanan` and `pembayaran` contain price/payment columns that must never reach a helper's browser (see CLAUDE.md: "Postgres RLS restricts rows, not columns"). Supabase Realtime `postgres_changes` payloads contain full row data gated only by RLS (row visibility), not column visibility — subscribing directly to `item_pesanan`/`pembayaran` would leak `harga_satuan`/`diskon`/`subtotal`/`jumlah` to helper browsers over the wire, even if the UI never renders it.

`pesanan` itself has no price/payment columns (confirmed via schema inspection), so it's safe to expose directly to both roles.

## Design

### Migration

- Add `updated_at timestamptz not null default now()` to `pesanan`.
- `BEFORE UPDATE` trigger on `pesanan` bumping `updated_at` on any direct edit (status, catatan, etc.).
- `AFTER INSERT/UPDATE/DELETE` trigger on `item_pesanan`, and the same on `pembayaran`, each bumping the parent `pesanan.updated_at` (via `pesanan_id`). This is what makes checklist toggles, price edits, and payment changes surface as a `pesanan` row change without ever broadcasting those tables' own rows.
- `alter publication supabase_realtime add table public.pesanan, public.pelanggan, public.users;` — nothing is currently published, so no realtime events fire today. RLS stays enabled and continues to gate which rows each subscriber receives, exactly as it already gates `select`.

### Client

- `src/hooks/use-realtime-refresh.ts`: hook taking `table: string` and optional `filter?: { column: string; value: string }`. Opens a Supabase Realtime channel via the existing browser client (`@/lib/supabase/client`), subscribes to `postgres_changes` (`event: '*'`) on that table/filter, debounces ~300ms, calls `router.refresh()`. Cleans up the channel on unmount.
- `src/components/realtime/RealtimeRefresh.tsx`: `'use client'` wrapper rendering nothing, just invoking the hook — lets Server Component pages opt in without becoming client components themselves.
- No visible indicator on refresh (silent), per user preference — matches how `revalidatePath` already silently re-renders after Server Actions.

### Wiring

| Page | Subscribe to | Filter |
|---|---|---|
| `pesanan/[id]/page.tsx` | `pesanan` | `id = <pesanan.id>` |
| `pesanan/page.tsx` | `pesanan` | none |
| `dashboard/page.tsx` | `pesanan` | none |
| `pelanggan/page.tsx` | `pelanggan` | none |
| `pengaturan/page.tsx` | `users` | none |

## Out of scope

- Optimistic merge of realtime payload into client state (we always re-fetch via `router.refresh()`, never read the realtime payload's row data directly) — this is intentional, not a shortcut: it's what keeps the role-aware server-side query (and its column masking) as the single source of truth.
- Broadcast-from-database / `realtime.broadcast_changes` — unnecessary since `pesanan` has no sensitive columns; plain `postgres_changes` on `pesanan` is sufficient and simpler.
- Toast/visual "data updated" indicator — explicitly declined.
