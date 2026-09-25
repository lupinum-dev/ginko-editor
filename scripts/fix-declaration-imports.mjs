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
    const edits = []
    for (const literal of candidates) {
      // Vue declarations are emitted as `Name.vue.d.ts`; NodeNext needs `Name.vue.js`.
      if (!literal.text.startsWith('.') || !['', '.vue'].includes(extname(literal.text))) continue
      // Only rewrite emitted modules, never directory aliases or external paths.
      try { await access(resolve(dirname(path), `${literal.text}.d.ts`)) } catch { continue }
      const end = literal.getEnd() - 1
      edits.push({ start: end, end, text: '.js' })
    }
    // Declarations must not keep style side effects. Hosts import the extracted
    // `@lupinum/ginko-editor/style.css` export, and the source CSS is not emitted.
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause) continue
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
      if (!statement.moduleSpecifier.text.endsWith('.css')) continue
      const end = statement.getEnd()
      edits.push({ start: statement.getStart(parsed), end: source[end] === '\n' ? end + 1 : end, text: '' })
    }
    let result = source
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
    }
    if (result !== source) await writeFile(path, result)
  }
}
await fix(resolve('dist'))
