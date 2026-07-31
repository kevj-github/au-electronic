# AU Electronic — Sistem Manajemen Pesanan

Order-management / POS web app for AU Electronic. Handles customers (`pelanggan`),
orders (`pesanan`) and their line items, payments (`pembayaran`), invoice PDFs,
WhatsApp invoice messages, and receipt printing to an Epson dot-matrix printer
via ESC/P.

The UI is entirely in Indonesian. There are two roles:

- **owner** — full access: prices, payments, order status, settings, user management.
- **helper** — works the shop floor: sees orders and items, ticks off the picking
  checklist. Price and payment data is deliberately kept out of what helpers fetch.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn components built on Base UI · Supabase (Postgres + Auth + Realtime) ·
Vitest · `@react-pdf/renderer` · QZ Tray for ESC/P printing.

## Prerequisites

- **Node.js >= 20.9.0** (Next.js 16's minimum; CI runs Node 20)
- npm
- Access to the Supabase project (this app has no local database — see below)

## Setup

```bash
npm install
cp .env.example .env.local
```

Then fill in the three required variables in `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (browser + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Used by `src/lib/supabase/admin.ts` for user management (`createUser`, `deleteHelper`). Never expose it to the client. |

Start the dev server:

```bash
npm run dev
```

### Seeding test users

`create_test_users.mjs` creates owner/helper accounts. It reads `process.env`
but **does not load any `.env` file itself**, so it must be run with an explicit
env file:

```bash
node --env-file=.env.local create_test_users.mjs
```

Note the script is gitignored, so a fresh clone will not have it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build — **the critical pre-commit check** (see below) |
| `npm run start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Vitest, single run |

### Always run `npm run build` before considering a change done

A sync export in a `'use server'` file compiles cleanly under `tsc`, ESLint and
Vitest, but fails the production build with *"Server Actions must be async
functions"*. `npm run build` is the only check that catches this class of error,
along with several others documented in `CLAUDE.md`. CI runs it on every push.

## Continuous integration

`.github/workflows/ci.yml` runs `npm run lint`, `npm run test:run` and
`npm run build` on every push and pull request. The build step falls back to
placeholder Supabase values when repository secrets are not configured, so the
workflow stays green without real credentials.

## Database

Supabase is **remote-only** — there is no local CLI workflow and no
`supabase start`. Schema changes are applied directly to the live project via
the Supabase MCP tools. Files in `supabase/migrations/` are a *record* of what
has been applied, not a source of truth to replay locally.

`supabase/prepared/` holds reviewed SQL that has deliberately **not** been
applied yet; read the header comments in those files before running them.

## Printing

Receipt printing targets an Epson dot-matrix printer over ESC/P through
QZ Tray, which runs as a desktop app on the machine doing the printing.
Setup instructions: [`docs/cetak-epson-setup.md`](docs/cetak-epson-setup.md).

PDF invoices and WhatsApp invoice text are generated in the browser and need
no extra software.

## Further reading

- [`CLAUDE.md`](CLAUDE.md) — architecture notes and the accumulated codebase
  conventions (RLS/trigger gotchas, Server Action rules, PDF/print patterns,
  mobile-layout requirements). Read this before making non-trivial changes.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design specs and
  implementation plans for the major features.
