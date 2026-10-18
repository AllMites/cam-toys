import type { EngineApi, EngineStats, Layer, Need } from '@engine/types'
import { filters } from './filters'

// Fake engine for Phase 4. Draws an animated gradient + active layer names and emits
// fake stats. Failure modes for UI work: ?mock=nocam,busy,denied,slow,loading (comma list).
export const mockFlags = new Set(new URLSearchParams(location.search).get('mock')?.split(',') ?? [])

function emitter<T>() {
  const subs = new Set<(v: T) => void>()
  return {
    on(cb: (v: T) => void) { subs.add(cb); return () => { subs.delete(cb) } },
    emit(v: T) { for (const cb of subs) cb(v) }
  }
}

let W = 1280, H = 720
const byId = new Map(filters.map((f) => [f.id, f]))
const stats = emitter<EngineStats>()
const frames = emitter<[Uint8Array, number, number]>()
const errors = emitter<Error>()
const loading = emitter<Need[]>()

let layers: Layer[] = []
let raf = 0, statTimer = 0
let ctx: CanvasRenderingContext2D | null = null
const loaded = new Set<Need>()
const pending = new Set<Need>()
let bgr = new Uint8Array(W * H * 3) // ponytail: blank frame for the vcam pump; real engine reads back pixels

const fail = (name: string, msg: string) => new DOMException(msg, name)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function draw(t: number) {
  if (!ctx) return
  const s = t / 1000
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, `hsl(${262 + Math.sin(s * 0.4) * 14} 60% 18%)`)
  g.addColorStop(1, `hsl(${322 + Math.cos(s * 0.3) * 14} 55% 16%)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  for (const [i, hue] of [[0, 262], [1, 330]] as const) {
    const x = W * (0.3 + 0.4 * i) + Math.sin(s * (0.5 + i * 0.2)) * 160
    const y = H * 0.45 + Math.cos(s * (0.4 + i * 0.3)) * 110
    const r = ctx.createRadialGradient(x, y, 0, x, y, 420)
    r.addColorStop(0, `hsla(${hue} 90% 65% / 0.35)`)
    r.addColorStop(1, 'hsla(0 0% 0% / 0)')
    ctx.fillStyle = r
    ctx.fillRect(0, 0, W, H)
  }
  // stand-in "person": head + shoulders, gently bobbing
  const bob = Math.sin(s * 1.6) * 6
  ctx.fillStyle = 'rgba(10, 10, 14, 0.55)'
  ctx.beginPath(); ctx.arc(W / 2, H * 0.42 + bob, 120, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(W / 2, H + 40 + bob, 300, 220, 0, Math.PI, 0); ctx.fill()

  const on = layers.filter((l) => l.enabled)
  ctx.font = '600 26px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  let y = 44
  for (const l of on) {
    const f = byId.get(l.filterId)
    const label = `${f?.icon ?? '?'}  ${f?.name ?? l.filterId}`
    const w = ctx.measureText(label).width + 40
    ctx.fillStyle = 'rgba(15, 15, 18, 0.6)'
    ctx.beginPath(); ctx.roundRect(36, y - 24, w, 48, 24); ctx.fill()
    ctx.fillStyle = '#f4f4f5'
    ctx.fillText(label, 56, y)
    y += 60
  }
  ctx.font = '600 18px Inter, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(244, 244, 245, 0.35)'
  ctx.textAlign = 'right'
  ctx.fillText('MOCK PREVIEW', W - 32, H - 30)
  ctx.textAlign = 'left'

  frames.emit([bgr, W, H])
  raf = requestAnimationFrame(draw)
}

function trackNeeds() {
  const needs = new Set(layers.filter((l) => l.enabled).flatMap((l) => byId.get(l.filterId)?.needs ?? []))
  for (const n of [...loaded]) if (!needs.has(n)) loaded.delete(n) // unload unused models
  const dropped = [...pending].filter((n) => !needs.has(n))
  for (const n of dropped) pending.delete(n) // cancel loads nobody needs any more
  const fresh = [...needs].filter((n) => !loaded.has(n) && !pending.has(n))
  if (!fresh.length) { if (dropped.length) loading.emit([...pending]); return }
  for (const n of fresh) pending.add(n)
  loading.emit([...pending])
  setTimeout(() => {
    for (const n of fresh) if (pending.delete(n)) loaded.add(n)
    loading.emit([...pending])
  }, mockFlags.has('loading') ? 8000 : 1500)
}

function emitStats() {
  const heavy = layers.filter((l) => l.enabled && byId.get(l.filterId)?.cost === 'heavy').length
  const base = mockFlags.has('slow') ? 19 : 31 - 5 * heavy
  stats.emit({ fps: Math.max(1, Math.round(base - Math.random() * 2)), trackMs: 4 + Math.random() * 3, renderMs: 2 + Math.random() * 2 })
}

export const mockEngine: EngineApi & { onLoading(cb: (needs: Need[]) => void): () => void } = {
  async start(canvas) {
    this.stop()
    await wait(500)
    if (mockFlags.has('nocam')) throw fail('NotFoundError', 'No camera found')
    if (mockFlags.has('busy')) throw fail('NotReadableError', 'Camera is in use by another app')
    if (mockFlags.has('denied')) throw fail('NotAllowedError', 'Camera permission denied')
    const s = await window.camtoys.settings.get() // engine owns res/fps: start() takes no size args
    if (s.width !== W) { W = s.width; H = s.height; bgr = new Uint8Array(W * H * 3) }
    canvas.width = W; canvas.height = H
    ctx = canvas.getContext('2d')
    raf = requestAnimationFrame(draw)
    statTimer = window.setInterval(emitStats, 500)
  },
  stop() {
    cancelAnimationFrame(raf)
    clearInterval(statTimer)
  },
  setLayers(next) {
    layers = next
    trackNeeds()
  },
  async listCameras() {
    if (mockFlags.has('nocam')) return []
    const cam = (deviceId: string, label: string) =>
      ({ deviceId, label, kind: 'videoinput', groupId: '', toJSON: () => ({}) }) as MediaDeviceInfo
    return [cam('mock-c920', 'Logitech HD Pro Webcam C920'), cam('mock-int', 'Integrated Webcam')]
  },
  snapshot: () => new Promise((res, rej) => (ctx?.canvas as HTMLCanvasElement | undefined)?.toBlob((b) => (b ? res(b) : rej(new Error('no frame')))) ?? rej(new Error('not started'))),
  onStats: stats.on,
  onFrame: (cb) => frames.on(([b, w, h]) => cb(b, w, h)),
  onError: errors.on,
  onLoading: loading.on
}
