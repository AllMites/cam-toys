import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rgbaToBgr } from './convert.ts'

test('rgbaToBgr swizzles and drops alpha, keeping row order', () => {
  // 2x2 image, rows top-down: [red, green] / [blue, white]
  const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 1, 2, 3, 4])
  const bgr = rgbaToBgr(rgba, new Uint8Array(12))
  assert.deepEqual([...bgr], [0, 0, 255, 0, 255, 0, 255, 0, 0, 3, 2, 1])
})

test('rgbaToBgr rejects a short destination', () => {
  assert.throws(() => rgbaToBgr(new Uint8Array(8), new Uint8Array(5)), RangeError)
})
