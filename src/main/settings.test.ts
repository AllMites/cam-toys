import { test } from 'node:test'
import assert from 'node:assert/strict'
import { merge, DEFAULTS } from './settings.ts'

test('merge fills defaults and drops unknown keys', () => {
  const s = merge({ fps: 60, bogus: 1 })
  assert.equal(s.fps, 60)
  assert.equal(s.width, DEFAULTS.width)
  assert.ok(!('bogus' in s))
})

test('merge survives garbage', () => {
  assert.deepEqual(merge(null), DEFAULTS)
  assert.deepEqual(merge('nope'), DEFAULTS)
})
