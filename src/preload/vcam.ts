import { execFileSync } from 'node:child_process'
import koffi from 'koffi'
import dllPath from '../../resources/softcam.dll?asset&asarUnpack'
import type { VcamApi } from '../engine/types'

// Must match the CLSID patched in by native/build-softcam.ps1.
const CLSID = '{1CAB239F-CB40-4AF9-B98C-9623FA4382B0}'

type Fns = {
  create: (w: number, h: number, fps: number) => unknown
  send: (cam: unknown, bgr: Uint8Array) => void
  del: (cam: unknown) => void
}

let fns: Fns | null | undefined // undefined = not tried yet, null = load failed
function load(): Fns | null {
  if (fns !== undefined) return fns
  try {
    const lib = koffi.load(dllPath)
    fns = {
      create: lib.func('void *scCreateCamera(int, int, float)'),
      send: lib.func('void scSendFrame(void *, const uint8_t *)'),
      del: lib.func('void scDeleteCamera(void *)')
    }
  } catch (e) {
    console.error('[vcam] softcam.dll failed to load', dllPath, e)
    fns = null
  }
  return fns
}

let registered = false
function isRegistered(): boolean {
  if (registered) return true // only cache "yes": user may register while the app runs
  try {
    execFileSync('reg', ['query', `HKCR\\CLSID\\${CLSID}\\InprocServer32`], { stdio: 'ignore', windowsHide: true })
    registered = true
  } catch { /* not registered */ }
  return registered
}

let cam: unknown = null
let size = 0

export const vcam: VcamApi & { testPattern?: (seconds?: number) => void } = {
  available: () => load() !== null && isRegistered(),
  start(width, height, fps) {
    vcam.stop()
    const f = load()
    if (!f || width % 4 || height % 4) return false // softcam needs multiples of 4
    // ponytail: fps is ignored; 0 = scSendFrame never sleeps (it runs on the renderer thread).
    // The engine paces frames. Apps then see a nominal 60 fps format.
    void fps
    cam = f.create(width, height, 0) || null
    size = width * height * 3
    return cam !== null
  },
  send(bgr) {
    if (cam && fns && bgr.length === size) fns.send(cam, bgr)
  },
  stop() {
    if (cam && fns) fns.del(cam)
    cam = null
  }
}

if (import.meta.env.DEV) {
  // Dev only: in devtools run `camtoys.vcam.testPattern()` then pick "cam-toys" in Discord/Zoom.
  vcam.testPattern = (seconds = 60) => {
    const w = 1280, h = 720
    if (!vcam.start(w, h, 30)) return console.error('[vcam] start failed (registered? another instance running?)')
    const buf = new Uint8Array(w * h * 3)
    const t0 = performance.now()
    const timer = setInterval(() => {
      const t = (performance.now() - t0) / 1000
      if (t > seconds) { clearInterval(timer); vcam.stop(); return }
      drawPattern(buf, w, h, t)
      vcam.send(buf)
    }, 1000 / 30)
    console.log(`[vcam] test pattern running for ${seconds}s`)
  }
}

// 3x5 bitmap digits 0-9, one 15-bit row-major mask each.
const DIGITS = [31599, 9362, 29671, 29647, 23497, 31183, 31215, 29330, 31727, 31695]

function drawPattern(buf: Uint8Array, w: number, h: number, t: number): void {
  const bar = Math.floor((t * 0.25 % 1) * w)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      const onBar = Math.abs(x - bar) < 20
      buf[i] = onBar ? 255 : (x * 255) / w               // B
      buf[i + 1] = onBar ? 255 : (y * 255) / h           // G
      buf[i + 2] = onBar ? 255 : (t * 60) % 256          // R
    }
  }
  // Elapsed seconds, top-left, white, 16px per bitmap pixel. Top-down rows, so y=0 is the top.
  const text = String(Math.floor(t))
  const s = 16
  for (let d = 0; d < text.length; d++) {
    const mask = DIGITS[+text[d]]
    for (let py = 0; py < 5; py++) for (let px = 0; px < 3; px++) {
      if (!((mask >> (14 - (py * 3 + px))) & 1)) continue
      for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) {
        const x = 32 + d * 4 * s + px * s + xx, y = 32 + py * s + yy
        buf.fill(255, (y * w + x) * 3, (y * w + x) * 3 + 3)
      }
    }
  }
}
