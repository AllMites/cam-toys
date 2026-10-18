import type { EngineApi, EngineStats, Layer, Need } from '@engine/types'
import type { EngineOptions } from '@engine/engine'

export interface Format { width: number; height: number; fps: number }
export type AdaptiveEngine = EngineApi & { onLoading(cb: (needs: Need[]) => void): () => void }
type Create = (opts: EngineOptions) => EngineApi

// One stable EngineApi for the UI. createEngine fixes width/height/fps per instance, so
// start() re-reads the format and rebuilds the inner engine when it changed, keeping
// subscribers and the current layers.
export function createAdaptiveEngine(getFormat: () => Promise<Format>, create: Create): AdaptiveEngine {
  const stats = new Set<(s: EngineStats) => void>()
  const frames = new Set<(bgr: Uint8Array, w: number, h: number) => void>()
  const errors = new Set<(e: Error) => void>()
  const loading = new Set<(needs: Need[]) => void>()
  const sub = <T>(set: Set<T>, cb: T) => (set.add(cb), () => void set.delete(cb))

  let inner: EngineApi | null = null
  let fmt: Format | null = null
  let layers: Layer[] = []

  function build(f: Format): EngineApi {
    inner?.stop()
    fmt = f
    const e = create({ ...f, onLoading: (n) => loading.forEach((cb) => cb(n)) })
    e.onStats((s) => stats.forEach((cb) => cb(s)))
    e.onFrame((b, w, h) => frames.forEach((cb) => cb(b, w, h)))
    e.onError((err) => errors.forEach((cb) => cb(err)))
    e.setLayers(layers)
    return (inner = e)
  }
  const same = (a: Format | null, b: Format) => !!a && a.width === b.width && a.height === b.height && a.fps === b.fps
  async function current(): Promise<EngineApi> {
    const f = await getFormat()
    return inner && same(fmt, f) ? inner : build(f)
  }

  return {
    async start(canvas, deviceId) { await (await current()).start(canvas, deviceId) },
    stop: () => inner?.stop(),
    setLayers(next) { layers = next; inner?.setLayers(next) },
    listCameras: async () => (await current()).listCameras(),
    snapshot: () => (inner ? inner.snapshot() : Promise.reject(new Error('Camera is not running.'))),
    onStats: (cb) => sub(stats, cb),
    onFrame: (cb) => sub(frames, cb),
    onError: (cb) => sub(errors, cb),
    onLoading: (cb) => sub(loading, cb)
  }
}
