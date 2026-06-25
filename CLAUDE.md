@AGENTS.md

## Commands

```bash
npm run dev        # Next.js dev server (Turbopack)
npm run build       # Production build — the only check that catches async/Server Action errors (see below)
npm run test:run    # Vitest, single run
npm run lint        # ESLint
```

## Architecture

- Route groups: `src/app/(auth)/` (login/register, public) and `src/app/(app)/` (dashboard/pelanggan/pengaturan/pesanan, behind auth + role checks). Layout for `(app)` composes `AppShell` (client) wrapping `Sidebar`/`TopBar`/children.
- Supabase is **remote-only** — there is no local CLI/`supabase start` workflow. Schema changes go straight to the live project (ref `pjkddahrjjqblexxhaef`, region ap-southeast-1) via the Supabase MCP tools (`apply_migration`, `execute_sql`, `get_advisors`); migration files in `supabase/migrations/` are a record of what's already been applied, not a local source of truth to replay.
- `src/lib/supabase/server.ts` / `client.ts` / `admin.ts` are the only places Supabase clients should be constructed (server component / browser / service-role respectively); `require-owner.ts` wraps the owner-role check used by gated Server Actions.

## Environment

`.env.example` lists the 3 required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service-role key is server-only, used by `admin.ts` for user-management actions like `createUser`/`deleteHelper`).

## Codebase conventions (learned from Plans 2-4 implementation)

- **`'use server'` files: every export must be `async`.** A sync helper in a Server Actions file compiles fine under `tsc`/`eslint`/`vitest` but breaks `npm run build` ("Server Actions must be async functions"). Always run `npm run build` before calling Server Action changes done — it's the only check that catches this.
- **shadcn here uses Base UI (`@base-ui/react`), not Radix** (`components.json` → `"style": "base-nova"`). Composed components take a `render={<Button .../>}` prop instead of `asChild`. Don't hand-write Radix-pattern code from memory — inspect the generated component after `npx shadcn@latest add <name>`.
- **Owner-gated Server Actions**: use `requireOwner(supabase)` from `src/lib/supabase/require-owner.ts` rather than hand-rolling the auth+role check inline. RLS is the real authorization boundary; this is defense-in-depth.
- **`<form action={fn}>` requires `fn` to return `void | Promise<void>`.** Actions here return `{ error?: string }` for error surfacing, so form-triggered deletes/mutations need a small client component with an `onClick` handler instead (see `DeletePaymentButton.tsx`).
- **Popup-blocker-safe pattern for print/PDF flows**: call `window.open('', '_blank')` synchronously as the *first* statement in the click handler, before any `await` — navigate the captured window reference once async work finishes. Calling `window.open` after an `await` gets blocked by browsers.
- **Never pass a `next/dynamic`-wrapped component into `@react-pdf/renderer`'s `pdf()`.** `next/dynamic` wraps a component in `React.lazy` + Suspense, which only `react-dom` knows how to resolve. `pdf()` uses its own non-DOM reconciler and doesn't support Suspense, so it silently renders broken/empty output. If you need code-splitting for a PDF component, resolve it with a plain `await import('...')` inside the click handler instead, then pass the real component to `pdf()`.
- **RLS helper functions that query a table protected by a policy calling that same function need `SECURITY DEFINER`.** Without it, the helper's own internal `SELECT` re-triggers the calling policy, which calls the helper again. This can look fine for authenticated users (their own row usually short-circuits the policy's `OR`) but causes genuine infinite recursion ("stack depth limit exceeded") for anonymous/unauthenticated requests, where `auth.uid()` is `NULL` and `id = NULL` evaluates to `UNKNOWN` rather than `FALSE`. Reproduce/verify with a direct `curl` against `/rest/v1/<table>` using the anon key — `npm run build`/tests won't catch this since it's a runtime Postgres behavior.
- **Sequence-generating `SECURITY DEFINER` functions (e.g. `kode_pesanan` numbering) should use `INSERT ... ON CONFLICT DO UPDATE ... RETURNING ... INTO`, not a separate `SELECT`/`UPDATE ... WHERE` pair.** A two-statement read-then-write can return zero rows (no existing row for this period yet) and silently produce `NULL`, which then violates a downstream `NOT NULL` constraint. An upsert always affects exactly one row, structurally eliminating that failure class.
- **Postgres check constraints are enforced per-statement, not deferred, even within one migration transaction.** If a migration both backfills a column to satisfy a new shape and drops/relaxes an old constraint that the backfill would transiently violate, the constraint drop must run *before* the backfill `UPDATE`, regardless of the fact that the constrained column or table is dropped later in the same migration.
- **When a migration's backfill `UPDATE` touches a table guarded by a write trigger that assumes a real session (`auth.uid()`), wrap the backfill in `alter table ... disable trigger <name>` / `... enable trigger <name>`.** Migrations run without a real authenticated user, so role-checking triggers will reject the backfill otherwise.
- **Shared client-side UI state needed by sibling Server Components in a layout (e.g. a mobile sidebar-drawer toggle shared between the sidebar and the top bar) can't live in the Server Component layout itself.** Lift it into a small client wrapper component (e.g. `AppShell.tsx`) that holds the `useState` and composes the Server-rendered children as props/`children`, rather than trying to thread state through the Server Component tree.
- **Every UI change must be checked on mobile too, not just desktop.** This app has no desktop-only audience — tables need a `sm:hidden` card layout alongside the `hidden sm:block` table (see `OrderList.tsx`), and any inline editor (e.g. `ItemPriceEditor.tsx`) needs to be checked for how it behaves squeezed into a narrow column/card, not just a wide desktop layout. Don't consider a UI task done until you've reasoned through (or viewed) it at a mobile viewport width.
- **Postgres RLS restricts rows, not columns — it can't hide specific fields (e.g. prices) from one app role while allowing another role to read the rest of the same row.** All authenticated users share one Postgres role (`authenticated`); the `role` column distinguishing owner/helper is just data. To keep price data out of a helper's hands, don't fetch `harga_satuan`/`diskon`/`subtotal`/`pembayaran` in Server Components for non-owners at all — an unfetched field never reaches the RSC payload sent to the browser. This is an app-layer guarantee, not a DB-layer one: a helper extracting the anon key and hitting `/rest/v1/item_pesanan` directly could still read those columns, since RLS only gates which *rows* are visible. Closing that gap fully would need a Postgres view with per-role column masking — not implemented, since it requires the embedded table to become writable via `INSTEAD OF` triggers and duplicates the existing trigger logic.
