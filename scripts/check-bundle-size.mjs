#!/usr/bin/env node
/**
 * Fails the build if any route's eager (first-load) client JS exceeds a
 * budget. CLAUDE.md documents a past regression where `/pesanan/[id]` shipped
 * 1901 KB of eager JS (a static `import { pdf } from '@react-pdf/renderer'`
 * dragging in pdfkit + the yoga-layout WASM shim) against ~400-590 KB for
 * every other route — `next build` doesn't print bundle sizes and nothing
 * else here catches this class of regression before it ships.
 *
 * Reads each route's `page_client-reference-manifest.js` (written by `next
 * build` under `.next/server/app/**`), which is not valid JSON — it's a
 * script that assigns `globalThis.__RSC_MANIFEST[routeKey] = {...}` — so it's
 * evaluated in a throwaway vm context to get the object back out.
 *
 * `entryJSFiles["[project]/src/app<routeKey>"]` is the ordered list of every
 * JS chunk (this route's own code + all ancestor layouts) the browser must
 * fetch before the page can render — exactly "eager JS for this route". A
 * route with no client component boundary of its own (e.g. a fully
 * server-rendered page) has no such key and is treated as 0 KB, which is
 * correct: it ships nothing beyond the shared layout chunks accounted for
 * under the layout's own entry.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const ROOT = process.cwd()
const NEXT_DIR = path.join(ROOT, '.next')
const APP_MANIFEST_DIR = path.join(NEXT_DIR, 'server', 'app')

// Current measured sizes (2026-09-07) top out at ~590 KB (`/pesanan/[id]`).
// This leaves real headroom for organic growth while still catching a
// regression anywhere near the past incident's scale (1901 KB, ~3x this).
// Bump deliberately if a route legitimately grows past it — don't raise it
// reflexively just to make a failure go away.
const BUDGET_KB = 750

if (!existsSync(APP_MANIFEST_DIR)) {
  console.error(`✗ ${path.relative(ROOT, APP_MANIFEST_DIR)} not found — run "next build" first.`)
  process.exit(1)
}

function findManifests(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      findManifests(full, files)
    } else if (entry === 'page_client-reference-manifest.js') {
      files.push(full)
    }
  }
  return files
}

function routeEagerKb(manifestFile) {
  const code = readFileSync(manifestFile, 'utf8')
  const sandbox = { globalThis: {} }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  const manifest = sandbox.globalThis.__RSC_MANIFEST
  const routeKey = Object.keys(manifest)[0]
  const { entryJSFiles = {} } = manifest[routeKey]
  const chunks = entryJSFiles[`[project]/src/app${routeKey}`] ?? []

  let bytes = 0
  for (const chunk of new Set(chunks)) {
    const chunkPath = path.join(NEXT_DIR, chunk)
    if (existsSync(chunkPath)) bytes += statSync(chunkPath).size
  }
  return { routeKey, kb: bytes / 1024 }
}

const routes = findManifests(APP_MANIFEST_DIR)
  .map(routeEagerKb)
  .sort((a, b) => b.kb - a.kb)

const overBudget = routes.filter((r) => r.kb > BUDGET_KB)

console.log(`Eager JS per route (budget ${BUDGET_KB} KB):`)
for (const r of routes) {
  const flag = r.kb > BUDGET_KB ? ' ✗ OVER BUDGET' : ''
  console.log(`  ${r.kb.toFixed(1).padStart(8)} KB  ${r.routeKey}${flag}`)
}

if (overBudget.length > 0) {
  console.error(
    `\n✗ ${overBudget.length} route(s) exceed the ${BUDGET_KB} KB eager JS budget. ` +
      'Check for a static import that should be a dynamic import() inside a click ' +
      "handler instead — see CLAUDE.md's note on @react-pdf/renderer's pdf().\n",
  )
  process.exit(1)
}

console.log(`\n✓ All routes within the ${BUDGET_KB} KB eager JS budget.`)
