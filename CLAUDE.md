@AGENTS.md

## Codebase conventions (learned from Plans 2-4 implementation)

- **`'use server'` files: every export must be `async`.** A sync helper in a Server Actions file compiles fine under `tsc`/`eslint`/`vitest` but breaks `npm run build` ("Server Actions must be async functions"). Always run `npm run build` before calling Server Action changes done — it's the only check that catches this.
- **shadcn here uses Base UI (`@base-ui/react`), not Radix** (`components.json` → `"style": "base-nova"`). Composed components take a `render={<Button .../>}` prop instead of `asChild`. Don't hand-write Radix-pattern code from memory — inspect the generated component after `npx shadcn@latest add <name>`.
- **Owner-gated Server Actions**: use `requireOwner(supabase)` from `src/lib/supabase/require-owner.ts` rather than hand-rolling the auth+role check inline. RLS is the real authorization boundary; this is defense-in-depth.
- **`<form action={fn}>` requires `fn` to return `void | Promise<void>`.** Actions here return `{ error?: string }` for error surfacing, so form-triggered deletes/mutations need a small client component with an `onClick` handler instead (see `DeletePaymentButton.tsx`).
- **Popup-blocker-safe pattern for print/PDF flows**: call `window.open('', '_blank')` synchronously as the *first* statement in the click handler, before any `await` — navigate the captured window reference once async work finishes. Calling `window.open` after an `await` gets blocked by browsers.
