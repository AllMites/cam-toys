// Static check (no WebGL): every preset layer points at a real filter file, every param key
// exists in that filter, and string values (select options) appear in its source.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { presets } from './presets.ts'

const root = join(import.meta.dirname, '..', 'filters')
const files = new Map<string, string>()
for (const d of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()))
  for (const f of readdirSync(join(root, d.name))) if (f.endsWith('.ts')) files.set(f.slice(0, -3), join(root, d.name, f))

test('presets reference real filters, params and options', () => {
  const ids = new Set<string>()
  for (const p of presets) {
    assert.ok(!ids.has(p.id), `duplicate preset ${p.id}`)
    ids.add(p.id)
    for (const l of p.layers) {
      const file = files.get(l.filterId)
      assert.ok(file, `${p.id}: no filter '${l.filterId}'`)
      const src = readFileSync(file!, 'utf8')
      for (const [k, v] of Object.entries(l.params)) {
        assert.match(src, new RegExp(String.raw`\b${k}:\s*\{`), `${p.id}/${l.filterId}: no param '${k}'`)
        if (typeof v === 'string') assert.ok(src.includes(`'${v}'`), `${p.id}/${l.filterId}: '${v}' not an option of ${k}`)
      }
    }
  }
})
