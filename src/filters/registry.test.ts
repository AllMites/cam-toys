// Static check of the filter registry (no WebGL): every non-'_' file in src/filters/<category>/
// is one filter whose id matches its filename. index.ts globs the same set.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = import.meta.dirname
const CATEGORIES = ['face', 'eyes', 'hands', 'body', 'background', 'color', 'retro', 'art']

const files = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => readdirSync(join(root, d.name)).filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !f.endsWith('.test.ts')).map((f) => ({ cat: d.name, file: f })))

test('at least 38 filters, unique ids matching filenames', () => {
  assert.ok(files.length >= 38, `only ${files.length} filters`)
  const ids = new Set<string>()
  for (const { cat, file } of files) {
    const src = readFileSync(join(root, cat, file), 'utf8')
    const id = src.match(/\bid:\s*'([^']+)'/)?.[1]
    assert.equal(id, file.slice(0, -3), `${cat}/${file}: id must equal filename`)
    assert.ok(!ids.has(id!), `duplicate id ${id}`)
    ids.add(id!)
    assert.match(src, new RegExp(String.raw`category:\s*'${cat}'`), `${cat}/${file}: category must match folder`)
    assert.ok(CATEGORIES.includes(cat), `unknown category folder ${cat}`)
    assert.match(src, /export default/, `${cat}/${file}: needs a default export`)
  }
})
