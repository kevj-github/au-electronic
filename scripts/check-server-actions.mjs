#!/usr/bin/env node
/**
 * Flags non-async exports in 'use server' files.
 *
 * Next.js requires every export from a 'use server' file to be an async
 * function ("Server Actions must be async functions"). A sync helper in such
 * a file compiles fine under `tsc`/`eslint`/`vitest` — none of them know
 * about this Next-specific rule — and only fails `next build`, which is slow
 * to run just to catch this one class of mistake. This script parses the AST
 * of every 'use server' file and checks each export directly, without a full
 * compile.
 *
 * Handles: `export async function`, `export const x = async () => {}` /
 * `async function () {}`, `export { x }` (resolved against the file's own
 * top-level declarations), and `export default`. A named re-export from
 * another module (`export { x } from './y'`) can't be resolved locally and
 * is reported separately for manual review rather than silently skipped.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const IGNORE_DIRS = new Set(['node_modules', '.next', 'coverage'])

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, files)
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

function hasUseServerDirective(sourceFile) {
  for (const stmt of sourceFile.statements) {
    if (!ts.isExpressionStatement(stmt) || !ts.isStringLiteral(stmt.expression)) {
      break
    }
    if (stmt.expression.text === 'use server') return true
  }
  return false
}

function hasModifier(node, kind) {
  return !!node.modifiers?.some((m) => m.kind === kind)
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node)
  )
}

function isAsync(node) {
  return hasModifier(node, ts.SyntaxKind.AsyncKeyword)
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

/** Returns null if the file has no 'use server' directive, otherwise a list of issues. */
function checkFile(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKind)
  if (!hasUseServerDirective(sourceFile)) return null

  // Top-level declarations by name, to resolve `export { x }` back to the
  // function it names.
  const localDecls = new Map()
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      localDecls.set(stmt.name.text, stmt)
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer) {
          localDecls.set(decl.name.text, decl.initializer)
        }
      }
    }
  }

  const issues = []
  const unresolved = []

  function reportIfSync(name, node, line) {
    if (isFunctionLike(node) && !isAsync(node)) {
      issues.push({ name, line })
    }
  }

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword) && stmt.name) {
      reportIfSync(stmt.name.text, stmt, lineOf(sourceFile, stmt))
    } else if (ts.isVariableStatement(stmt) && hasModifier(stmt, ts.SyntaxKind.ExportKeyword)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && isFunctionLike(decl.initializer)) {
          reportIfSync(decl.name.text, decl.initializer, lineOf(sourceFile, stmt))
        }
      }
    } else if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const spec of stmt.exportClause.elements) {
        const line = lineOf(sourceFile, spec)
        if (stmt.moduleSpecifier) {
          unresolved.push({ name: spec.name.text, line })
          continue
        }
        const localName = (spec.propertyName ?? spec.name).text
        const node = localDecls.get(localName)
        if (node) reportIfSync(spec.name.text, node, line)
      }
    } else if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      let expr = stmt.expression
      if (ts.isIdentifier(expr)) {
        expr = localDecls.get(expr.text) ?? expr
      }
      reportIfSync('default', expr, lineOf(sourceFile, stmt))
    }
  }

  return { issues, unresolved }
}

const files = walk(SRC_DIR)
const serverActionFiles = []
const violations = []
const unresolvedExports = []

for (const file of files) {
  const result = checkFile(file)
  if (result === null) continue
  serverActionFiles.push(file)
  for (const issue of result.issues) violations.push({ file, ...issue })
  for (const item of result.unresolved) unresolvedExports.push({ file, ...item })
}

if (violations.length > 0) {
  console.error(`\n✗ Found ${violations.length} non-async export(s) in 'use server' files:\n`)
  for (const v of violations) {
    console.error(`  ${path.relative(ROOT, v.file)}:${v.line}  export "${v.name}" is not async`)
  }
  console.error(
    '\n  Next.js requires every export from a \'use server\' file to be an async\n' +
      '  function ("Server Actions must be async functions"). This passes tsc/eslint/\n' +
      '  vitest but fails `npm run build` — see CLAUDE.md.\n',
  )
  process.exit(1)
}

if (unresolvedExports.length > 0) {
  console.log(
    `⚠ ${unresolvedExports.length} re-exported name(s) from other modules could not be checked ` +
      "statically — verify these are async at their source:",
  )
  for (const u of unresolvedExports) {
    console.log(`  ${path.relative(ROOT, u.file)}:${u.line}  export "${u.name}"`)
  }
}

console.log(`✓ All exports across ${serverActionFiles.length} 'use server' file(s) are async`)
