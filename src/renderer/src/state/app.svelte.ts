import type { Category, EngineStats, FilterDef, Layer, Need, Preset, Settings } from '@engine/types'
import { engine, filters, presets, onLoading } from '../engine-source'
import * as stack from './stack'

export const byId = new Map(filters.map((f) => [f.id, f]))

export type CamError = 'nocam' | 'busy' | 'denied' | 'other'
export interface Toast { id: number; icon: string; text: string }
export interface Tip { title: string; text: string; x: number; y: number }

export const app = $state({
  settings: null as Settings | null,
  layers: [] as Layer[],
  stats: { fps: 0, trackMs: 0, renderMs: 0 } as EngineStats,
  cameras: [] as MediaDeviceInfo[],
  status: 'starting' as 'starting' | 'running' | 'error',
  error: null as CamError | null,
  errorMsg: '',
  loading: [] as Need[],
  activePreset: null as string | null,
  tab: 'featured' as Category,
  vcamOk: false,
  live: false,
  drawerOpen: true,
  settingsOpen: false,
  tutorialStep: -1, // -1 = hidden
  heavyAsk: null as null | { names: string; run: () => void },
  toasts: [] as Toast[],
  tip: null as Tip | null
})

const api = () => window.camtoys
let canvas: HTMLCanvasElement | null = null
let heavyOk = false // ⚡ warning asked once per session
let lastFrame = 0
let lowSince = 0, lastSlowToast = 0
let saveTimer = 0

// ---------- feedback ----------
let toastId = 0
export function toast(icon: string, text: string, ms = 4500) {
  const id = ++toastId
  app.toasts.push({ id, icon, text })
  setTimeout(() => dismissToast(id), ms)
}
export const dismissToast = (id: number) => { app.toasts = app.toasts.filter((t) => t.id !== id) }

// ---------- boot ----------
export async function init() {
  const s = await api().settings.get()
  app.settings = s
  app.layers = stack.fromSaved(s.lastLayers, byId)
  app.tutorialStep = s.tutorialDone ? -1 : 0
  app.vcamOk = api().vcam.available()

  engine.onStats(onStats)
  engine.onError((e) => setError(e))
  onLoading((needs) => { app.loading = needs })
  engine.onFrame((bgr, w, h) => {
    const st = app.settings
    if (!app.vcamOk || !st || w !== st.width || h !== st.height) return
    api().vcam.send(bgr)
    lastFrame = performance.now()
  })
  setInterval(() => { app.live = app.vcamOk && performance.now() - lastFrame < 1000 }, 500)

  // single sink: every layer change (including in-place param edits) reaches the engine + disk
  $effect.root(() => {
    $effect(() => {
      const snap = $state.snapshot(app.layers) as Layer[]
      engine.setLayers(snap)
      clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => api().settings.set({ lastLayers: stack.toSaved(snap) }), 400)
    })
  })
}

export async function startCamera(el?: HTMLCanvasElement) {
  if (el) canvas = el
  if (!canvas || !app.settings) return
  app.status = 'starting'
  app.error = null
  try {
    app.cameras = await engine.listCameras()
    if (!app.cameras.length) throw new DOMException('No camera found', 'NotFoundError')
    const id = app.settings.cameraId
    const known = app.cameras.some((c) => c.deviceId === id)
    await engine.start(canvas, known ? id! : app.cameras[0].deviceId)
    app.status = 'running'
    restartVcam()
  } catch (e) {
    setError(e as Error)
  }
}

function setError(e: Error) {
  app.status = 'error'
  app.errorMsg = e.message
  app.error = e.name === 'NotFoundError' || e.name === 'OverconstrainedError' ? 'nocam'
    : e.name === 'NotReadableError' || e.name === 'AbortError' ? 'busy'
    : e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'denied'
    : 'other'
}

function restartVcam() {
  const v = api().vcam, s = app.settings
  if (!s || !v.available()) return
  v.stop()
  app.vcamOk = v.start(s.width, s.height, s.fps)
}

function onStats(s: EngineStats) {
  app.stats = s
  const now = performance.now()
  if (s.fps >= 24 || !app.layers.some((l) => l.enabled)) { lowSince = 0; return }
  lowSince ||= now
  if (now - lowSince > 3000 && now - lastSlowToast > 30000) {
    lastSlowToast = now
    const heavy = app.layers.some((l) => l.enabled && byId.get(l.filterId)?.cost === 'heavy')
    toast('🐢', heavy ? `Running slow (${s.fps} fps). Try turning off ⚡ filters.` : `Running slow (${s.fps} fps). Try fewer layers or 720p.`, 7000)
  }
}

// ---------- settings ----------
export async function setSettings(patch: Partial<Settings>) {
  const prev = app.settings
  app.settings = await api().settings.set(patch)
  const s = app.settings
  if (!prev) return
  if (prev.cameraId !== s.cameraId || prev.width !== s.width || prev.fps !== s.fps) await startCamera()
}

// ---------- stack actions ----------
function guardHeavy(defs: (FilterDef | undefined)[], run: () => void) {
  const heavy = defs.filter((d): d is FilterDef => d?.cost === 'heavy')
  if (!heavy.length || heavyOk) return run()
  app.heavyAsk = { names: heavy.map((d) => d.name).join(' + '), run: () => { heavyOk = true; run() } }
}

export const inStack = (id: string) => app.layers.some((l) => l.filterId === id)

// Tap a bubble: add it on top. Tap again to take it off.
export function tapFilter(def: FilterDef) {
  if (inStack(def.id)) {
    app.layers = app.layers.filter((l) => l.filterId !== def.id)
    app.activePreset = null
    return
  }
  guardHeavy([def], () => {
    app.layers = [...app.layers, stack.makeLayer(def)]
    app.activePreset = null
    toast(def.icon, `${def.name} added`, 2200)
  })
}

export function tapPreset(p: Preset) {
  guardHeavy(p.layers.map((l) => byId.get(l.filterId)), () => {
    app.layers = stack.applyPreset(p, byId)
    app.activePreset = p.id
  })
}

export function randomize() {
  app.layers = stack.randomStack(filters)
  app.activePreset = null
  app.drawerOpen = true
  toast('🎲', 'Surprise! ' + app.layers.map((l) => byId.get(l.filterId)?.icon).join(' '), 2500)
}

export const removeLayer = (uid: string) => {
  app.layers = app.layers.filter((l) => l.uid !== uid)
  app.activePreset = null
}
export const moveLayer = (from: number, to: number) => { app.layers = stack.move(app.layers, from, to) }
export const clearLayers = () => { app.layers = []; app.activePreset = null }

// ---------- tutorial ----------
export const openTutorial = () => { app.settingsOpen = false; app.tutorialStep = 0 }
export function closeTutorial() {
  app.tutorialStep = -1
  if (!app.settings?.tutorialDone) setSettings({ tutorialDone: true })
}

export { filters, presets }
