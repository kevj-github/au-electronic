import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the client/server boundary that broke both order lists in production.
 *
 * `toOrderRows` is called during server render by /pesanan and /dashboard. It
 * used to be exported from `OrderList.tsx`, which is a `'use client'` module —
 * so Next resolved the import to a client reference instead of the function and
 * every render threw:
 *
 *     Attempted to call toOrderRows() from the server but toOrderRows is on the
 *     client.
 *
 * Both pages showed the error boundary and no orders at all. Nothing caught it:
 * tsc, eslint, the unit tests and a local `next build` on Node 20 were all
 * clean, and it only surfaced on the Node 22 that Vercel builds with.
 *
 * These assertions are deliberately source-text based. The failure is a
 * bundler-resolution property, so importing the modules here would not
 * reproduce it — only where the function *lives* and where the pages import it
 * *from* can be checked cheaply.
 */

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const CLIENT_DIRECTIVE = /^\s*['"]use client['"]/

describe('order-row server/client boundary', () => {
  it('order-row.ts is server-safe: no "use client" directive', () => {
    expect(CLIENT_DIRECTIVE.test(read('src/components/pesanan/order-row.ts'))).toBe(false)
  })

  it('OrderList.tsx is still a client component', () => {
    expect(CLIENT_DIRECTIVE.test(read('src/components/pesanan/OrderList.tsx'))).toBe(true)
  })

  it('OrderList.tsx does not define the server-called projection functions', () => {
    const src = read('src/components/pesanan/OrderList.tsx')
    expect(src).not.toMatch(/export\s+function\s+toOrderRows/)
    expect(src).not.toMatch(/export\s+function\s+deriveOrderRow/)
  })

  for (const page of [
    'src/app/(app)/pesanan/page.tsx',
    'src/app/(app)/dashboard/page.tsx',
  ]) {
    it(`${page} imports toOrderRows from the server-safe module`, () => {
      const src = read(page)
      // It must import the function from order-row...
      expect(src).toMatch(
        /import\s*{[^}]*\btoOrderRows\b[^}]*}\s*from\s*['"][^'"]*\/order-row['"]/,
      )
      // ...and must not pull any runtime binding out of OrderList. A bare
      // `import type { ... } from '.../OrderList'` is fine; this only rejects a
      // value import that names toOrderRows.
      const valueImportsFromOrderList = [
        ...src.matchAll(/import\s+(?!type\s)(\{[^}]*\})\s*from\s*['"][^'"]*OrderList['"]/g),
      ]
      for (const [, clause] of valueImportsFromOrderList) {
        expect(clause).not.toMatch(/\btoOrderRows\b/)
        expect(clause).not.toMatch(/\bderiveOrderRow\b/)
      }
    })
  }
})
