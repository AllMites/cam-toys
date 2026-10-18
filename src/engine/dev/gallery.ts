// Dev-only: run the camera through any registered filters. Not part of the app bundle.
import { filters } from '@filters/index'
import { createEngine } from '../engine'
import type { Layer, ParamValues } from '../types'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const canvas = $<HTMLCanvasElement>('view')
const engine = createEngine()
const layers: Layer[] = filters.map((f) => ({
  uid: f.id,
  filterId: f.id,
  enabled: false,
  params: Object.fromEntries(Object.entries(f.params).map(([k, p]) => [k, p.default])) as ParamValues
}))

engine.onStats((s) => ($('stats').textContent = `${s.fps.toFixed(1)} fps · track ${s.trackMs.toFixed(1)} ms · render ${s.renderMs.toFixed(1)} ms`))
engine.onError((e) => ($('err').textContent = e.message))

for (const l of layers) {
  const f = filters.find((x) => x.id === l.filterId)!
  const row = document.createElement('label')
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.onchange = () => {
    l.enabled = box.checked
    engine.setLayers(layers.map((x) => ({ ...x })))
  }
  row.append(box, `${f.icon} ${f.name}`, Object.assign(document.createElement('small'), { textContent: `${f.category} · ${f.cost} · ${f.needs.join(',') || 'no trackers'}` }))
  $('list').append(row)
}

let unsub: (() => void) | null = null
$<HTMLInputElement>('vcam').onchange = (e) => {
  unsub?.()
  unsub = null
  $('vcamInfo').textContent = ''
  if (!(e.target as HTMLInputElement).checked) return
  let n = 0, t = performance.now()
  unsub = engine.onFrame((bgr, w, h) => {
    n++
    const el = performance.now() - t
    if (el > 1000) {
      // Centre pixel, BGR → shows the readback is alive and the bytes are sane.
      const i = ((h >> 1) * w + (w >> 1)) * 3
      $('vcamInfo').textContent = `${w}x${h} · ${((n * 1000) / el).toFixed(1)} frames/s · centre bgr ${bgr[i]},${bgr[i + 1]},${bgr[i + 2]}`
      n = 0
      t = performance.now()
    }
  })
}

$('snap').onclick = async () => {
  const blob = await engine.snapshot()
  window.open(URL.createObjectURL(blob))
}

const cam = $<HTMLSelectElement>('cam')
cam.onchange = () => engine.start(canvas, cam.value).catch(() => {})
engine.start(canvas).then(async () => {
  for (const d of await engine.listCameras()) cam.add(new Option(d.label || d.deviceId, d.deviceId))
}, () => {})
