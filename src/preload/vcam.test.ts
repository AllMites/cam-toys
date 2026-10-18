import { test } from 'node:test'
import assert from 'node:assert/strict'
import koffi from 'koffi'

// ABI smoke test: the committed DLL loads and the sender API works without registration.
test('softcam.dll exports the sender API', () => {
  const lib = koffi.load('resources/softcam.dll')
  const create = lib.func('void *scCreateCamera(int, int, float)')
  const send = lib.func('void scSendFrame(void *, const uint8_t *)')
  const del = lib.func('void scDeleteCamera(void *)')
  const cam = create(64, 48, 0)
  assert.ok(cam)
  assert.equal(create(64, 48, 0), null) // one instance per system
  send(cam, new Uint8Array(64 * 48 * 3))
  del(cam)
})
