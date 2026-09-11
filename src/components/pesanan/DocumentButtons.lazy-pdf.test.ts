import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

// Regression guard for the bundle-size fix documented in CLAUDE.md: a static
// top-level `import { pdf } from '@react-pdf/renderer'` drags in pdfkit + the
// yoga-layout WASM shim (~1.6 MB) into this route's eager bundle. It must stay
// a dynamic `import()` inside the click handler. This is invisible to
// `tsc`/`eslint`/a normal render test — only a build's per-route bundle size
// or a check like this one catches a regression.

const filePath = join(__dirname, 'DocumentButtons.tsx')
const source = readFileSync(filePath, 'utf-8')
const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const staticImports = sourceFile.statements.filter(ts.isImportDeclaration)

function staticallyImports(moduleSpecifier: string): boolean {
  return staticImports.some(
    (imp) => ts.isStringLiteral(imp.moduleSpecifier) && imp.moduleSpecifier.text === moduleSpecifier
  )
}

describe('DocumentButtons lazy pdf import', () => {
  it('does not statically import @react-pdf/renderer at module scope', () => {
    expect(staticallyImports('@react-pdf/renderer')).toBe(false)
  })

  it('does not statically import DocumentPDF at module scope', () => {
    expect(staticallyImports('@/components/invoice/DocumentPDF')).toBe(false)
  })

  it('lazily imports @react-pdf/renderer via a dynamic import()', () => {
    expect(source).toMatch(/import\(\s*['"]@react-pdf\/renderer['"]\s*\)/)
  })

  it('lazily imports DocumentPDF via a dynamic import()', () => {
    expect(source).toMatch(/import\(\s*['"]@\/components\/invoice\/DocumentPDF['"]\s*\)/)
  })

  it('never wraps DocumentPDF in next/dynamic (unsupported by pdf()\'s reconciler)', () => {
    expect(staticallyImports('next/dynamic')).toBe(false)
  })
})
