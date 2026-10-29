// Shared helpers for Face AR filters: face geometry, premultiplied sticker textures,
// a rotated textured-quad sticker drawer, and a face-oval-masked skin smoother.
import type { Frame, Pt } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'

/** MediaPipe face-mesh oval, clockwise from forehead top (10). */
export const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

export const hex = (s: string): [number, number, number] => {
  const n = parseInt(String(s).replace('#', ''), 16) || 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))
/** Frame-rate independent approach of `cur` toward `target` (rate ≈ 1/seconds). */
export const approach = (cur: number, target: number, rate: number, dt: number): number =>
  cur + (target - cur) * (1 - Math.exp(-rate * Math.max(0, dt)))

/** Face measured in PIXELS (y down). `right`/`down` are unit vectors of the head's roll. */
export interface FaceGeo {
  pts: Pt[]
  W: number          // face width (cheek 234 ↔ 454), px
  H: number          // face height (forehead 10 ↔ chin 152), px
  roll: number       // radians, + = clockwise on screen
  right: [number, number]
  down: [number, number]
  /** Landmark i in px. */
  p(i: number): [number, number]
  /** Offset from `base` by (lx, ly) face-widths along head right/down. */
  at(base: [number, number], lx: number, ly: number): [number, number]
}

/** Returns null when there is no usable face. */
export function faceGeo(f: Frame): FaceGeo | null {
  const pts = f.face?.faces?.[0]
  if (!pts || pts.length < 468) return null
  const w = f.width, h = f.height
  const p = (i: number): [number, number] => [pts[i].x * w, pts[i].y * h]
  const [ax, ay] = p(33), [bx, by] = p(263)
  const roll = Math.atan2(by - ay, bx - ax)
  const c = Math.cos(roll), s = Math.sin(roll)
  const [lx, ly] = p(234), [rx, ry] = p(454)
  const [tx, ty] = p(10), [cx, cy] = p(152)
  const W = Math.max(1, Math.hypot(rx - lx, ry - ly))
  const H = Math.max(1, Math.hypot(cx - tx, cy - ty))
  const right: [number, number] = [c, s]
  const down: [number, number] = [-s, c]
  return {
    pts, W, H, roll, right, down, p,
    at: (b, ox, oy) => [b[0] + (right[0] * ox + down[0] * oy) * W, b[1] + (right[1] * ox + down[1] * oy) * W]
  }
}

export const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

/** Average of two blendshapes (0 when missing). */
export function blend(f: Frame, ...names: string[]): number {
  const b = f.face?.blendshapes?.[0]
  if (!b || !names.length) return 0
  let s = 0
  for (const n of names) s += b[n] ?? 0
  return s / names.length
}

function upload(gl: WebGL2RenderingContext, src: TexImageSource, nearest: boolean): WebGLTexture {
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  if (nearest) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  } else {
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }
  return t
}

/** Premultiplied-alpha texture drawn with a 2D context (sync). */
export function canvasTex(gl: WebGL2RenderingContext, w: number, h: number, draw: (ctx: OffscreenCanvasRenderingContext2D) => void, nearest = false): WebGLTexture {
  const c = new OffscreenCanvas(w, h)
  draw(c.getContext('2d')!)
  return upload(gl, c, nearest)
}

/** SVG → premultiplied, mipmapped texture, loaded async. `get()` is null until ready. */
export function svgTex(gl: WebGL2RenderingContext, svg: string, w: number, h: number): { get(): WebGLTexture | null; dispose(): void } {
  let tex: WebGLTexture | null = null
  let dead = false
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const img = new Image(w, h)
  img.src = url
  img.decode().then(() => {
    if (dead) return
    const c = new OffscreenCanvas(w, h)
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    tex = upload(gl, c, false)
  }).catch(() => {}).finally(() => URL.revokeObjectURL(url))
  return {
    get: () => tex,
    dispose() { dead = true; if (tex) gl.deleteTexture(tex); tex = null }
  }
}

const STICKER_VS = `#version 300 es
uniform vec2 uRes, uCenter, uSize; uniform float uRot;
out vec2 vUv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vUv = c;
  vec2 l = (c - 0.5) * uSize;
  float cs = cos(uRot), sn = sin(uRot);
  vec2 p = uCenter + vec2(l.x * cs - l.y * sn, l.x * sn + l.y * cs);
  gl_Position = vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0);
}`
const STICKER_FS = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec3 uTint; uniform float uAlpha;
void main() {
  vec4 t = texture(uTex, vUv);
  o = vec4(t.rgb * uTint, t.a) * uAlpha;
}`

export interface Sticker {
  /** Draw `tex` centred at (cx, cy) px, size sw×sh px (negative sw mirrors), rotated `rot` rad. */
  draw(f: Frame, tex: WebGLTexture, cx: number, cy: number, sw: number, sh: number, rot: number, alpha?: number, tint?: [number, number, number]): void
  dispose(): void
}

export function makeSticker(gl: WebGL2RenderingContext): Sticker {
  const p = program(gl, STICKER_FS, STICKER_VS)
  const u = uniforms(gl, p)
  const vao = gl.createVertexArray()
  return {
    draw(f, tex, cx, cy, sw, sh, rot, alpha = 1, tint = [1, 1, 1]) {
      if (alpha <= 0.001) return
      gl.useProgram(p)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      bindTexture(gl, 0, tex, u.uTex)
      gl.uniform2f(u.uRes, f.width, f.height)
      gl.uniform2f(u.uCenter, cx, cy)
      gl.uniform2f(u.uSize, sw, sh)
      gl.uniform1f(u.uRot, rot)
      gl.uniform1f(u.uAlpha, alpha)
      gl.uniform3f(u.uTint, tint[0], tint[1], tint[2])
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      gl.bindVertexArray(null)
    },
    dispose() { gl.deleteProgram(p); gl.deleteVertexArray(vao) }
  }
}

/**
 * Ear-style placement: a sticker whose BOTTOM-centre sits at `base`, leaning `tilt` rad
 * (+ = clockwise) from the head's up direction.
 */
export function drawFromBase(s: Sticker, f: Frame, g: FaceGeo, tex: WebGLTexture, base: [number, number], w: number, h: number, tilt: number, alpha = 1, tint?: [number, number, number]): void {
  const a = g.roll + tilt
  const ux = Math.sin(a), uy = -Math.cos(a)
  s.draw(f, tex, base[0] + ux * h / 2, base[1] + uy * h / 2, w, h, a, alpha, tint)
}

// --- Skin smoothing masked to the face oval -------------------------------------------------

/** GLSL signed distance (px, - = inside) to the 36-point `uniform vec2 uPoly[36]` (fill it from OVAL). */
export const SD_POLY = `float sdPoly(vec2 p) {
  float d = dot(p - uPoly[0], p - uPoly[0]);
  float s = 1.0;
  for (int i = 0; i < 36; i++) {
    int j = i == 0 ? 35 : i - 1;
    vec2 e = uPoly[j] - uPoly[i];
    vec2 w = p - uPoly[i];
    vec2 b = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-4), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= uPoly[i].y, p.y < uPoly[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
`

const SMOOTH_FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform vec2 uRes;
uniform vec2 uPoly[36];
uniform vec4 uBox;
uniform float uFeather, uRadius, uSmooth, uBright, uWarm;
${SD_POLY}
void main() {
  vec4 c = texture(uInput, uv);
  vec2 px = uv * uRes;
  if (px.x < uBox.x || px.y < uBox.y || px.x > uBox.z || px.y > uBox.w) { o = c; return; }
  float d = sdPoly(px);
  float m = 1.0 - smoothstep(-uFeather, uFeather * 0.25, d);
  if (m <= 0.0) { o = c; return; }
  vec3 sum = c.rgb; float wsum = 1.0;
  vec2 texel = 1.0 / uRes;
  for (int r = 1; r <= 2; r++) {
    float rad = uRadius * float(r) * 0.5;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.785398 + float(r) * 0.3927;
      vec3 s = texture(uInput, uv + vec2(cos(a), sin(a)) * rad * texel).rgb;
      vec3 dd = s - c.rgb;
      float w = exp(-dot(dd, dd) * 60.0);
      sum += s * w; wsum += w;
    }
  }
  vec3 col = mix(c.rgb, sum / wsum, uSmooth * m);
  col = 1.0 - (1.0 - col) * (1.0 - 0.3 * uBright * m);
  col += vec3(0.03, 0.01, -0.01) * uWarm * m;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

export interface Smoother {
  /** Fullscreen pass from f.input into the bound target (writes every pixel). */
  render(f: Frame, g: FaceGeo, smooth: number, bright: number, warm: number): void
  dispose(): void
}

export function makeSmoother(gl: WebGL2RenderingContext): Smoother {
  const p = program(gl, SMOOTH_FS)
  const u = uniforms(gl, p)
  const poly = new Float32Array(72)
  return {
    render(f, g, smooth, bright, warm) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
      for (let i = 0; i < 36; i++) {
        const [x, y] = g.p(OVAL[i])
        poly[i * 2] = x; poly[i * 2 + 1] = y
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
      }
      const feather = g.W * 0.08
      gl.disable(gl.BLEND)
      gl.useProgram(p)
      bindTexture(gl, 0, f.input, u.uInput)
      gl.uniform2f(u.uRes, f.width, f.height)
      gl.uniform2fv(u.uPoly, poly)
      gl.uniform4f(u.uBox, x0 - feather, y0 - feather, x1 + feather, y1 + feather)
      gl.uniform1f(u.uFeather, feather)
      gl.uniform1f(u.uRadius, Math.max(2, g.W * 0.025))
      gl.uniform1f(u.uSmooth, smooth)
      gl.uniform1f(u.uBright, bright)
      gl.uniform1f(u.uWarm, warm)
      drawFullscreen(gl)
    },
    dispose: () => gl.deleteProgram(p)
  }
}
