// The engine: camera → trackers → layer pass chain → preview canvas + output frames.
import { filters } from '@filters/index'
import { cameraError, listCameras, openCamera } from './camera'
import { rgbaToBgr } from './convert'
import { copy, deleteTarget, target, texture, type Target } from './gl'
import { Trackers } from './trackers'
import type { EngineApi, EngineStats, FilterDef, FilterInstance, Frame, Layer, Need } from './types'

export interface EngineOptions {
  width?: number // requested camera + output size; default 1280x720@30
  height?: number
  fps?: number
  registry?: FilterDef[] // default: every filter in src/filters
}

type FrameCb = (bgr: Uint8Array, w: number, h: number) => void
interface Running { def: FilterDef; inst: FilterInstance }
interface Readback { buf: WebGLBuffer; sync: WebGLSync | null }

export function createEngine(opts: EngineOptions = {}): EngineApi {
  const W = opts.width ?? 1280, H = opts.height ?? 720, FPS = opts.fps ?? 30
  const byId = new Map((opts.registry ?? filters).map((f) => [f.id, f]))

  const statsCbs = new Set<(s: EngineStats) => void>()
  const frameCbs = new Set<FrameCb>()
  const errorCbs = new Set<(e: Error) => void>()
  const emitError = (e: Error): void => {
    if (errorCbs.size === 0) console.error(e)
    errorCbs.forEach((cb) => cb(e))
  }
  const sub = <T>(set: Set<T>, cb: T): (() => void) => (set.add(cb), () => void set.delete(cb))

  const trackers = new Trackers(emitError)
  let layers: Layer[] = []
  const running = new Map<string, Running>() // key: uid + filterId
  const broken = new Set<string>() // layers that threw; skipped until setLayers changes them

  let gl: WebGL2RenderingContext | null = null
  let canvas: HTMLCanvasElement | null = null
  let track: MediaStreamTrack | null = null
  let reader: ReadableStreamDefaultReader<VideoFrame> | null = null
  let input: WebGLTexture, mask: WebGLTexture
  let ping: Target[] = []
  let out: Target
  const readbacks: Readback[] = []
  let rgba = new Uint8Array(0), bgr = new Uint8Array(0)
  let snapWaiters: { resolve: (b: Blob) => void; reject: (e: Error) => void }[] = []

  let lastTime = 0
  let stat = { frames: 0, track: 0, render: 0, since: performance.now() }

  const key = (l: Layer): string => `${l.uid}:${l.filterId}`

  function reconcile(): void {
    const want = new Set<string>()
    const needs = new Set<Need>()
    for (const l of layers) {
      const def = byId.get(l.filterId)
      if (!l.enabled || !def || broken.has(key(l))) continue
      want.add(key(l))
      def.needs.forEach((n) => needs.add(n))
      if (gl && !running.has(key(l))) {
        try {
          running.set(key(l), { def, inst: def.create(gl) })
        } catch (e) {
          broken.add(key(l))
          emitError(new Error(`Filter "${def.name}" failed to start: ${(e as Error).message}`, { cause: e }))
        }
      }
    }
    for (const [k, r] of running) if (!want.has(k)) { r.inst.dispose(); running.delete(k) }
    trackers.want(reader ? needs : [])
  }

  function initGl(c: HTMLCanvasElement): void {
    if (canvas === c && gl) return
    const ctx = c.getContext('webgl2', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: false })
    if (!ctx) throw new Error('WebGL2 is not available on this computer.')
    canvas = c
    gl = ctx
    input = texture(gl)
    mask = texture(gl)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]))
    out = target(gl, W, H)
    readbacks.length = 0
    for (let i = 0; i < 3; i++) readbacks.push({ buf: gl.createBuffer(), sync: null })
    rgba = new Uint8Array(W * H * 4)
    bgr = new Uint8Array(W * H * 3)
    ping = []
  }

  function sizeChain(w: number, h: number): void {
    if (ping[0]?.width === w && ping[0]?.height === h) return
    ping.forEach((t) => deleteTarget(gl!, t))
    ping = [target(gl!, w, h), target(gl!, w, h)]
    canvas!.width = w
    canvas!.height = h
  }

  /** Collect finished async readbacks and hand BGR frames to subscribers. */
  function pollReadbacks(g: WebGL2RenderingContext): void {
    for (const r of readbacks) {
      if (!r.sync) continue
      const s = g.clientWaitSync(r.sync, 0, 0)
      if (s === g.TIMEOUT_EXPIRED) continue
      g.deleteSync(r.sync)
      r.sync = null
      if (s === g.WAIT_FAILED || frameCbs.size === 0) continue
      g.bindBuffer(g.PIXEL_PACK_BUFFER, r.buf)
      g.getBufferSubData(g.PIXEL_PACK_BUFFER, 0, rgba)
      g.bindBuffer(g.PIXEL_PACK_BUFFER, null)
      rgbaToBgr(rgba, bgr)
      frameCbs.forEach((cb) => cb(bgr, W, H)) // bgr is reused next frame: copy if you keep it
    }
  }

  function startReadback(g: WebGL2RenderingContext): void {
    const r = readbacks.find((x) => !x.sync)
    if (!r) return // GPU is behind; drop this frame rather than stall
    g.bindBuffer(g.PIXEL_PACK_BUFFER, r.buf)
    if (g.getBufferParameter(g.PIXEL_PACK_BUFFER, g.BUFFER_SIZE) !== rgba.length)
      g.bufferData(g.PIXEL_PACK_BUFFER, rgba.length, g.STREAM_READ)
    g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, 0)
    g.bindBuffer(g.PIXEL_PACK_BUFFER, null)
    r.sync = g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE, 0)
    g.flush()
  }

  async function snapshotPng(g: WebGL2RenderingContext): Promise<Blob> {
    const px = new Uint8ClampedArray(W * H * 4)
    g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, px)
    const c = new OffscreenCanvas(W, H)
    c.getContext('2d')!.putImageData(new ImageData(px, W, H), 0, 0) // row 0 = top already
    return c.convertToBlob({ type: 'image/png' })
  }

  /** One camera frame in → one tracked, rendered frame out. */
  async function pump(frames: ReadableStreamDefaultReader<VideoFrame>): Promise<void> {
    for (;;) {
      const { value, done } = await frames.read().catch(() => ({ value: undefined, done: true }))
      if (done || !value) return
      try {
        if (reader === frames) tick(value)
      } finally {
        value.close()
      }
    }
  }

  function tick(vf: VideoFrame): void {
    const g = gl!
    const t0 = performance.now()

    // 1. Upload the camera frame.
    const w = vf.displayWidth, h = vf.displayHeight
    sizeChain(w, h)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
    g.bindTexture(g.TEXTURE_2D, input)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, vf)

    // 2. Track (only the trackers some layer needs).
    let res: ReturnType<Trackers['run']> = {}
    try {
      res = trackers.run(vf)
    } catch (e) {
      emitError(new Error(`Tracking failed: ${(e as Error).message}`, { cause: e }))
    }
    if (res.mask) {
      g.bindTexture(g.TEXTURE_2D, mask)
      g.pixelStorei(g.UNPACK_ALIGNMENT, 1)
      g.texImage2D(g.TEXTURE_2D, 0, g.R8, res.mask.width, res.mask.height, 0, g.RED, g.UNSIGNED_BYTE, res.mask.data)
      g.pixelStorei(g.UNPACK_ALIGNMENT, 4)
    }
    const t1 = performance.now()

    // 3. Pass chain: each enabled layer reads the previous output.
    const time = vf.timestamp / 1e6
    const dt = lastTime ? Math.min(time - lastTime, 0.25) : 1 / FPS
    lastTime = time
    let src = input, i = 0
    for (const l of layers) {
      const r = running.get(key(l))
      if (!r) continue
      const dst = ping[i]
      const frame: Frame = {
        input: src, output: dst.fbo, width: w, height: h, time, dt,
        face: res.face, hands: res.hands, pose: res.pose,
        mask: r.def.needs.includes('segment') ? mask : undefined
      }
      g.bindFramebuffer(g.FRAMEBUFFER, dst.fbo)
      g.viewport(0, 0, w, h)
      g.disable(g.BLEND)
      try {
        r.inst.render(frame, l.params)
      } catch (e) {
        r.inst.dispose()
        running.delete(key(l))
        broken.add(key(l))
        emitError(new Error(`Filter "${r.def.name}" crashed and was turned off: ${(e as Error).message}`, { cause: e }))
        continue
      }
      src = dst.tex
      i ^= 1
    }
    g.disable(g.BLEND)

    // 4. Preview: mirrored (selfie view) and flipped (canvas row 0 is the bottom).
    g.bindFramebuffer(g.FRAMEBUFFER, null)
    g.viewport(0, 0, w, h)
    copy(g, src, -1, -1)

    // 5. Output: un-mirrored at the requested size, only when someone wants pixels.
    pollReadbacks(g)
    if (frameCbs.size || snapWaiters.length) {
      g.bindFramebuffer(g.FRAMEBUFFER, out.fbo)
      g.viewport(0, 0, W, H)
      copy(g, src)
      if (snapWaiters.length) {
        const waiters = snapWaiters
        snapWaiters = []
        snapshotPng(g).then((b) => waiters.forEach((x) => x.resolve(b)), (e) => waiters.forEach((x) => x.reject(e)))
      }
      if (frameCbs.size) startReadback(g)
      g.bindFramebuffer(g.FRAMEBUFFER, null)
    }
    const t2 = performance.now()

    stat.frames++
    stat.track += t1 - t0
    stat.render += t2 - t1
    const el = t2 - stat.since
    if (el >= 500) {
      const s = { fps: (stat.frames * 1000) / el, trackMs: stat.track / stat.frames, renderMs: stat.render / stat.frames }
      statsCbs.forEach((cb) => cb(s))
      stat = { frames: 0, track: 0, render: 0, since: t2 }
    }
  }

  function stop(): void {
    reader?.cancel().catch(() => {})
    track?.stop()
    reader = null
    track = null
    for (const r of running.values()) r.inst.dispose()
    running.clear()
    trackers.close()
    snapWaiters.forEach((x) => x.reject(new Error('Engine stopped')))
    snapWaiters = []
  }

  return {
    async start(c, deviceId) {
      stop()
      try {
        initGl(c)
        const cam = await openCamera(deviceId, W, H, FPS)
        track = cam.track
        reader = cam.frames
        cam.track.addEventListener('ended', () => {
          if (track === cam.track) emitError(new Error('Camera was disconnected.'))
        })
      } catch (e) {
        const err = e instanceof Error ? e : cameraError(e)
        emitError(err)
        throw err
      }
      lastTime = 0
      reconcile()
      void pump(reader)
    },
    stop,
    setLayers(next) {
      // A crashed layer retries once the user turns it off (or removes it) and on again.
      for (const k of broken) if (!next.some((l) => l.enabled && key(l) === k)) broken.delete(k)
      layers = next
      reconcile()
    },
    listCameras,
    snapshot() {
      if (!reader) return Promise.reject(new Error('Camera is not running.'))
      return new Promise((resolve, reject) => snapWaiters.push({ resolve, reject }))
    },
    onStats: (cb) => sub(statsCbs, cb),
    onFrame: (cb) => sub(frameCbs, cb),
    onError: (cb) => sub(errorCbs, cb)
  }
}
