import { readdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import ts from 'typescript'

/** Bundler-mode Vue declarations must also resolve in NodeNext backends. */
async function fix(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) { await fix(path); continue }
    if (!entry.name.endsWith('.d.ts')) continue
    const source = await readFile(path, 'utf8')
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    const candidates = []
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        candidates.push(node.moduleSpecifier)
      }
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        candidates.push(node.argument.literal)
      }
      ts.forEachChild(node, visit)
    }
    visit(parsed)
    let result = source
    for (const literal of candidates.sort((a, b) => b.getStart(parsed) - a.getStart(parsed))) {
      if (!literal.text.startsWith('.') || extname(literal.text)) continue
      // Only rewrite emitted modules, never directory aliases or external paths.
      try { await access(resolve(dirname(path), `${literal.text}.d.ts`)) } catch { continue }
      const end = literal.getEnd() - 1
      result = result.slice(0, end) + '.js' + result.slice(end)
    }
    if (result !== source) await writeFile(path, result)
  }
}
await fix(resolve('dist'))
