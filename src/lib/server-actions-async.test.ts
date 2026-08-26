import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// CLAUDE.md: "'use server' files: every export must be async." A sync
// export compiles fine under tsc/eslint/vitest but breaks `npm run build`
// with "Server Actions must be async functions" — a failure class that has
// landed on `hermes` HEAD before (see commit bfebead). This test catches it
// without needing a full `next build`.

const SRC_DIR = path.resolve(__dirname, '..')

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(full, out)
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.d.ts')
    ) {
      out.push(full)
    }
  }
  return out
}

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
}

function hasUseServerDirective(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    if (!ts.isExpressionStatement(stmt) || !ts.isStringLiteral(stmt.expression)) break
    if (stmt.expression.text === 'use server') return true
  }
  return false
}

function hasModifier(node: ts.HasModifiers, kind: ts.SyntaxKind): boolean {
  return !!ts.getModifiers(node)?.some((m) => m.kind === kind)
}

/** Names of exported, non-async, function-like declarations. Type-only and
 * non-function exports (interfaces, constants) are out of scope — Next's
 * rule, and CLAUDE.md's note, are specifically about async functions. */
function findNonAsyncFunctionExports(sourceFile: ts.SourceFile): string[] {
  const violations: string[] = []

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      if (!hasModifier(stmt, ts.SyntaxKind.AsyncKeyword)) {
        violations.push(stmt.name?.text ?? '<default export>')
      }
      continue
    }

    if (ts.isVariableStatement(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer
        if (!init || !(ts.isArrowFunction(init) || ts.isFunctionExpression(init))) continue
        if (!hasModifier(init, ts.SyntaxKind.AsyncKeyword)) {
          violations.push(ts.isIdentifier(decl.name) ? decl.name.text : '<destructured export>')
        }
      }
    }
  }

  return violations
}

describe('findNonAsyncFunctionExports', () => {
  it('flags a sync function export', () => {
    const sourceFile = parse(
      'fixture.ts',
      `'use server'\nexport function doThing() {}\n`,
    )
    expect(findNonAsyncFunctionExports(sourceFile)).toEqual(['doThing'])
  })

  it('flags a sync arrow-function export', () => {
    const sourceFile = parse(
      'fixture.ts',
      `'use server'\nexport const doThing = () => {}\n`,
    )
    expect(findNonAsyncFunctionExports(sourceFile)).toEqual(['doThing'])
  })

  it('does not flag async function or arrow-function exports', () => {
    const sourceFile = parse(
      'fixture.ts',
      `'use server'\nexport async function a() {}\nexport const b = async () => {}\n`,
    )
    expect(findNonAsyncFunctionExports(sourceFile)).toEqual([])
  })

  it('does not flag type-only or non-function exports', () => {
    const sourceFile = parse(
      'fixture.ts',
      `'use server'\nexport interface Foo { id: string }\nexport async function a() {}\n`,
    )
    expect(findNonAsyncFunctionExports(sourceFile)).toEqual([])
  })
})

describe("'use server' files export only async functions", () => {
  const serverActionFiles = collectSourceFiles(SRC_DIR).filter((file) => {
    const source = fs.readFileSync(file, 'utf8')
    return hasUseServerDirective(parse(file, source))
  })

  it('found at least one \'use server\' file to check (guards against the glob silently matching nothing)', () => {
    expect(serverActionFiles.length).toBeGreaterThan(0)
  })

  it.each(serverActionFiles)('%s', (file) => {
    const source = fs.readFileSync(file, 'utf8')
    const violations = findNonAsyncFunctionExports(parse(file, source))
    expect(violations).toEqual([])
  })
})
