// Smoke page for scripts/smoke/run.mjs. Two passes per filter:
// 1. direct: create() + 40 render() calls on a synthetic cartoon frame with fake face/hands/pose/mask
//    (exercises shaders and landmark code paths; the fake camera has no face).
// 2. engine: the real engine + Chromium fake camera with only that layer on, watching onError.
import { filters } from '@filters/index'
import { createEngine } from '@engine/engine'
import { target, texture } from '@engine/gl'
import type { FaceResult, Frame, HandsResult, ParamValues, PoseResult, Pt } from '@engine/types'

const W = 640, H = 360, CW = 320, CH = 180
const only = new URLSearchParams(location.search).get('only')?.split(',')
const list = only ? filters.filter((f) => only.includes(f.id)) : filters
const log = (s: string) => { document.getElementById('log')!.textContent += s + '\n'; console.info('[smoke] ' + s) }
const P = (x: number, y: number, z = 0): Pt => ({ x, y, z })

// ---- synthetic scene ----
const cx = 0.5, cy = 0.45, fw = 0.12, fh = 0.27
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
function makeFace(open: number): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < 478; i++) {
    const a = i * 2.39996, r = Math.sqrt(i / 478) * 0.85
    pts.push(P(cx + Math.sin(a) * r * fw, cy - Math.cos(a) * r * fh))
  }
  OVAL.forEach((idx, k) => { const a = (k / OVAL.length) * Math.PI * 2; pts[idx] = P(cx + Math.sin(a) * fw, cy - Math.cos(a) * fh) })
  const set = (i: number, x: number, y: number) => (pts[i] = P(cx + x, cy + y))
  const ey = -0.06
  set(33, -0.08, ey); set(133, -0.025, ey); set(362, 0.025, ey); set(263, 0.08, ey)
  set(159, -0.052, ey - 0.02); set(145, -0.052, ey + 0.02); set(386, 0.052, ey - 0.02); set(374, 0.052, ey + 0.02)
  set(468, -0.052, ey); set(469, -0.04, ey); set(470, -0.052, ey - 0.02); set(471, -0.064, ey); set(472, -0.052, ey + 0.02)
  set(473, 0.052, ey); set(474, 0.064, ey); set(475, 0.052, ey - 0.02); set(476, 0.04, ey); set(477, 0.052, ey + 0.02)
  set(1, 0, 0.05); set(4, 0, 0.045); set(6, 0, -0.03); set(168, 0, -0.05)
  set(61, -0.045, 0.14); set(291, 0.045, 0.14); set(13, 0, 0.13); set(14, 0, 0.13 + 0.01 + open * 0.05)
  set(0, 0, 0.12); set(17, 0, 0.19)
  return pts
}
function makeHand(hx: number, hy: number, t: number, pinch: boolean): Pt[] {
  const pts = [P(hx, hy)]
  for (let f = 0; f < 5; f++) {
    const a = -1.1 + f * 0.5 + Math.sin(t * 2) * 0.1
    for (let j = 1; j <= 4; j++) pts.push(P(hx + Math.sin(a) * 0.035 * j * 0.56, hy - Math.cos(a) * 0.06 * j))
  }
  if (pinch) pts[4] = P(pts[8].x + 0.005, pts[8].y + 0.005)
  return pts
}
function makePose(): Pt[] {
  const pts = Array.from({ length: 33 }, (_, i) => P(cx + Math.sin(i) * 0.04, cy + Math.cos(i) * 0.08))
  const s = (i: number, x: number, y: number) => (pts[i] = P(x, y))
  s(0, cx, cy); s(11, 0.62, 0.82); s(12, 0.38, 0.82); s(13, 0.72, 0.95); s(14, 0.28, 0.95)
  s(15, 0.75, 0.7); s(16, 0.25, 0.7); s(23, 0.58, 1.2); s(24, 0.42, 1.2)
  return pts
}

function sceneCanvas(): OffscreenCanvas {
  const c = new OffscreenCanvas(W, H), g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, W, 0)
  ;['#f33', '#fb3', '#3c3', '#3cf', '#36f', '#c3f'].forEach((col, i) => grad.addColorStop(i / 5, col))
  g.fillStyle = grad; g.fillRect(0, 0, W, H)
  g.fillStyle = '#345'; g.fillRect(0, H * 0.15, W, H * 0.85)
  const px = (x: number) => x * W, py = (y: number) => y * H
  g.fillStyle = '#2a6'; g.beginPath(); g.ellipse(px(0.5), py(1.0), px(0.2), py(0.25), 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#e8b896'; g.beginPath(); g.ellipse(px(cx), py(cy), px(fw), py(fh), 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#fff'; for (const x of [-0.052, 0.052]) { g.beginPath(); g.ellipse(px(cx + x), py(cy - 0.06), px(0.025), py(0.025), 0, 0, 7); g.fill() }
  g.fillStyle = '#358'; for (const x of [-0.052, 0.052]) { g.beginPath(); g.arc(px(cx + x), py(cy - 0.06), py(0.02), 0, 7); g.fill() }
  g.fillStyle = '#a33'; g.beginPath(); g.ellipse(px(cx), py(cy + 0.155), px(0.04), py(0.03), 0, 0, 7); g.fill()
  return c
}

// ---- direct pass ----
async function direct() {
  const glc = new OffscreenCanvas(W, H)
  const gl = glc.getContext('webgl2', { premultipliedAlpha: false })!
  const scene = sceneCanvas()
  const input = texture(gl, scene)
  const inPx = scene.getContext('2d')!.getImageData(0, 0, W, H).data
  const maskData = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const head = ((x / W - cx) / fw) ** 2 + ((y / H - cy) / fh) ** 2 < 1.1
    const body = ((x / W - 0.5) / 0.2) ** 2 + ((y / H - 1) / 0.25) ** 2 < 1
    maskData[y * W + x] = head || body ? 255 : 0
  }
  const mask = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, mask)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, W, H, 0, gl.RED, gl.UNSIGNED_BYTE, maskData)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const out = target(gl, W, H)
  const px = new Uint8Array(W * H * 4)
  const sheet = new OffscreenCanvas(CW * 6, CH * Math.ceil(list.length / 6))
  const sg = sheet.getContext('2d')!
  const full = new OffscreenCanvas(W, H), fg = full.getContext('2d')!
  const gestures = ['Victory', 'Thumb_Up', 'ILoveYou', 'Open_Palm']
  const results: { id: string; ok: boolean; error?: string; changed: number; ms: number; engine: string }[] = []

  for (const [k, def] of list.entries()) {
    const params = Object.fromEntries(Object.entries(def.params).map(([n, p]) => [n, p.default])) as ParamValues
    const r = { id: def.id, ok: true, error: undefined as string | undefined, changed: 0, ms: 0, engine: '' }
    try {
      const inst = def.create(gl)
      let ms = 0
      for (let i = 0; i < 40; i++) {
        if (i === 20) await new Promise((res) => setTimeout(res, 400)) // let async SVG textures land
        const t = i / 30
        const blink = (i % 12) < 3 ? 1 : 0
        const face: FaceResult = { faces: [makeFace(0.8)], blendshapes: [{ jawOpen: 0.8, mouthSmileLeft: 0.8, mouthSmileRight: 0.8, eyeWideLeft: 0.8, eyeWideRight: 0.8, eyeBlinkLeft: blink, eyeBlinkRight: blink }] }
        const hands: HandsResult = { hands: [makeHand(0.22, 0.75, t, i % 20 < 14), makeHand(0.78 + Math.sin(t) * 0.03, 0.72, t, false)], handedness: ['Right', 'Left'], gestures: [gestures[Math.floor(i / 10) % 4], 'Victory'] }
        const pose: PoseResult = { poses: [makePose()] }
        const f: Frame = { input, output: out.fbo, width: W, height: H, time: 1 + t, dt: 1 / 30, mask, ...(def.needs.includes('face') ? { face } : {}), ...(def.needs.some((n) => n === 'hands' || n === 'gestures') ? { hands } : {}), ...(def.needs.includes('pose') ? { pose } : {}) }
        gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo)
        gl.viewport(0, 0, W, H)
        gl.disable(gl.BLEND)
        const t0 = performance.now()
        inst.render(f, params)
        ms += performance.now() - t0
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo)
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const err = gl.getError()
      if (err) throw new Error(`gl error 0x${err.toString(16)}`)
      let diff = 0
      for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - inPx[i]) + Math.abs(px[i + 1] - inPx[i + 1]) + Math.abs(px[i + 2] - inPx[i + 2]) > 24) diff++
      r.changed = Math.round((diff / (W * H)) * 100)
      r.ms = ms / 40
      inst.dispose()
      const img = new ImageData(new Uint8ClampedArray(px), W, H)
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255
      fg.putImageData(img, 0, 0)
    } catch (e) {
      r.ok = false
      r.error = String((e as Error)?.message ?? e).slice(0, 400)
      fg.fillStyle = '#600'; fg.fillRect(0, 0, W, H)
    }
    const x = (k % 6) * CW, y = Math.floor(k / 6) * CH
    sg.drawImage(full, x, y, CW, CH)
    sg.fillStyle = '#000a'; sg.fillRect(x, y, CW, 14)
    sg.fillStyle = r.ok ? '#fff' : '#f66'; sg.font = '11px monospace'; sg.fillText(`${def.id} ${r.changed}%`, x + 3, y + 11)
    log(`${r.ok ? 'ok' : 'FAIL'} ${def.id} ${r.error ?? ''}`)
    results.push(r)
  }
  return { results, sheet }
}

// ---- engine pass ----
async function engine(results: { id: string; ok: boolean; error?: string; engine: string }[]) {
  const eng = createEngine({ width: 640, height: 360, fps: 30 })
  let lastErr = ''
  let frames = 0
  eng.onError((e) => (lastErr = e.message))
  eng.onStats(() => frames++)
  await eng.start(document.getElementById('view') as HTMLCanvasElement)
  for (const r of results) {
    const def = filters.find((f) => f.id === r.id)!
    lastErr = ''
    frames = 0
    const params = Object.fromEntries(Object.entries(def.params).map(([n, p]) => [n, p.default])) as ParamValues
    eng.setLayers([{ uid: r.id, filterId: r.id, enabled: true, params }])
    await new Promise((res) => setTimeout(res, def.needs.length ? 2500 : 1000))
    r.engine = lastErr ? 'error' : frames ? 'ok' : 'no-stats'
    if (lastErr) { r.ok = false; r.error = (r.error ? r.error + ' | ' : '') + 'engine: ' + lastErr }
  }
  eng.setLayers([])
  eng.stop()
}

;(async () => {
  try {
    const { results, sheet } = await direct()
    if (!only) await engine(results) // SMOKE_ONLY=id,id is a quick visual pass: direct render only
    const blob = await sheet.convertToBlob({ type: 'image/png' })
    const url = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(blob) })
    ;(window as unknown as { __smoke: unknown }).__smoke = { results, sheet: url }
  } catch (e) {
    log('fatal ' + e)
    ;(window as unknown as { __smoke: unknown }).__smoke = { results: [{ id: 'fatal', ok: false, error: String(e), changed: 0, ms: 0, engine: '' }], sheet: 'data:,' }
  }
})()
