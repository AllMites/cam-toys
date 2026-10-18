import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EngineApi, Layer } from '@engine/types'
import { createAdaptiveEngine, type Format } from './engine-adapter.ts'

// Fake engine that records what the adapter does to it.
function fakeFactory() {
  const made: { opts: Format; layers: Layer[]; stopped: boolean; starts: number; emit: () => void }[] = []
  const create = (opts: Format) => {
    let statsCb: (s: { fps: number; trackMs: number; renderMs: number }) => void = () => {}
    const rec = { opts, layers: [] as Layer[], stopped: false, starts: 0, emit: () => statsCb({ fps: 30, trackMs: 0, renderMs: 0 }) }
    made.push(rec)
    const e: EngineApi = {
      start: async () => { rec.starts++ },
      stop: () => { rec.stopped = true },
      setLayers: (l) => { rec.layers = l },
      listCameras: async () => [],
      snapshot: async () => new Blob(),
      onStats: (cb) => ((statsCb = cb), () => {}),
      onFrame: () => () => {},
      onError: () => () => {}
    }
    return e
  }
  return { made, create }
}

const layer: Layer = { uid: 'a', filterId: 'bear', enabled: true, params: {} }
const canvas = {} as HTMLCanvasElement

test('same format reuses the engine; new format rebuilds with layers and subscribers', async () => {
  let fmt: Format = { width: 1280, height: 720, fps: 30 }
  const { made, create } = fakeFactory()
  const eng = createAdaptiveEngine(async () => fmt, create as never)
  let fps = 0
  eng.onStats((s) => { fps = s.fps })
  eng.setLayers([layer])

  await eng.start(canvas)
  await eng.start(canvas)
  assert.equal(made.length, 1)
  assert.equal(made[0].starts, 2)

  fmt = { width: 1920, height: 1080, fps: 30 }
  await eng.start(canvas)
  assert.equal(made.length, 2)
  assert.ok(made[0].stopped)
  assert.deepEqual(made[1].opts.width, 1920)
  assert.deepEqual(made[1].layers, [layer])
  made[1].emit()
  assert.equal(fps, 30)
})
