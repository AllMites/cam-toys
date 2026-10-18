import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FilterDef } from '@engine/types'
import { defaults, makeLayer, applyPreset, move, randomStack, fromSaved, toSaved } from './stack.ts'

const def = (id: string, category: FilterDef['category'], cost: FilterDef['cost'] = 'light'): FilterDef => ({
  id, name: id, category, icon: '?', cost, needs: [], hint: '',
  params: {
    a: { type: 'range', label: 'A', min: 0, max: 1, default: 0.5 },
    b: { type: 'color', label: 'B', default: '#fff' },
    c: { type: 'select', label: 'C', options: ['x', 'y'], default: 'y' },
    d: { type: 'toggle', label: 'D', default: true }
  },
  create: () => ({ render() {}, dispose() {} })
})
const all = [def('bear', 'face'), def('laser', 'eyes'), def('vhs', 'retro'), def('ghost', 'body', 'heavy'), def('neon', 'art', 'heavy')]
const byId = new Map(all.map((f) => [f.id, f]))

test('defaults covers every param kind', () => {
  assert.deepEqual(defaults(all[0]), { a: 0.5, b: '#fff', c: 'y', d: true })
})

test('makeLayer merges overrides and gets unique uids', () => {
  const a = makeLayer(all[0], { a: 0.9 }), b = makeLayer(all[0])
  assert.equal(a.params.a, 0.9)
  assert.equal(a.params.c, 'y')
  assert.notEqual(a.uid, b.uid)
})

test('applyPreset drops unknown filters and keeps enabled flag', () => {
  const out = applyPreset({ id: 'p', name: 'p', icon: '', layers: [
    { filterId: 'vhs', enabled: false, params: { c: 'x' } },
    { filterId: 'gone', enabled: true, params: {} }
  ] }, byId)
  assert.equal(out.length, 1)
  assert.equal(out[0].enabled, false)
  assert.equal(out[0].params.c, 'x')
  assert.equal(out[0].params.a, 0.5)
})

test('toSaved/fromSaved round-trip', () => {
  const layers = [makeLayer(all[0]), makeLayer(all[2])]
  assert.deepEqual(toSaved(fromSaved(toSaved(layers), byId)), toSaved(layers))
})

test('move reorders and ignores out-of-range', () => {
  assert.deepEqual(move([1, 2, 3], 0, 2), [2, 3, 1])
  assert.deepEqual(move([1, 2, 3], 2, 0), [3, 1, 2])
  const same = [1, 2]
  assert.equal(move(same, 0, 5), same)
})

test('randomStack never picks heavy filters', () => {
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 50; i++) {
    const s = randomStack(all, rnd)
    assert.ok(s.length >= 1)
    assert.ok(s.every((l) => byId.get(l.filterId)!.cost !== 'heavy'))
  }
})
