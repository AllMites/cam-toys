// Shared helpers for the hands filters (not a filter: underscore prefix).
// All drawing helpers take PIXEL coords (x right, y down from the image top) and convert to
// engine clip space (x/w*2-1, y/h*2-1, no Y flip). Output is premultiplied: draw with additive().
import type { Pt } from '@engine/types'
import { program } from '@engine/gl'

export type RGB = [number, number, number]

export const hex = (s: string): RGB => {
  const n = parseInt(s.replace('#', ''), 16) || 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** h 0..1 (wraps), s, v 0..1. Writes into `out` to avoid allocation. */
export function hsv(h: number, s: number, v: number, out: RGB = [0, 0, 0]): RGB {
  h = ((h % 1) + 1) % 1
  const i = Math.floor(h * 6), f = h * 6 - i
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
  const k = i % 6
  out[0] = k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p
  out[1] = k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p
  out[2] = k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p
  return out
}

/** MediaPipe HAND_CONNECTIONS (21 landmarks). */
export const HAND_CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
]
export const FINGERTIPS = [4, 8, 12, 16, 20] as const

/** Palm length (wrist -> middle-finger base) in pixels; a scale for "relative to hand size". */
export function handPx(p: Pt[], w: number, h: number): number {
  return Math.hypot((p[9].x - p[0].x) * w, (p[9].y - p[0].y) * h) || h * 0.1
}

/** Premultiplied additive blending (FUNC_ADD, ONE, ONE). */
export function additive(gl: WebGL2RenderingContext): void {
  gl.enable(gl.BLEND)
  gl.blendEquation(gl.FUNC_ADD)
  gl.blendFunc(gl.ONE, gl.ONE)
}

/** Put blend state back to defaults so later layers aren't surprised. */
export function resetBlend(gl: WebGL2RenderingContext): void {
  gl.blendEquation(gl.FUNC_ADD)
  gl.blendFunc(gl.ONE, gl.ZERO)
  gl.disable(gl.BLEND)
}

function attrib(gl: WebGL2RenderingContext, p: WebGLProgram, name: string, size: number, stride: number, offset: number): void {
  const loc = gl.getAttribLocation(p, name)
  if (loc < 0) return
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4)
}

// ---------------------------------------------------------------- thick glowing lines

const LINE_VS = `#version 300 es
in vec2 aPos; in vec2 aLocal; in float aLen; in vec4 aCol;
out vec2 vLocal; out float vLen; out vec4 vCol;
void main() { vLocal = aLocal; vLen = aLen; vCol = aCol; gl_Position = vec4(aPos, 0.0, 1.0); }`
const LINE_FS = `#version 300 es
precision highp float;
in vec2 vLocal; in float vLen; in vec4 vCol; out vec4 o;
uniform float uCore;
void main() {
  float dx = max(max(-vLocal.x, vLocal.x - vLen), 0.0);
  float d = length(vec2(dx, vLocal.y));
  if (d > 1.0) discard;
  float glow = exp(-d * d * 4.0) * (1.0 - d);
  float core = 1.0 - smoothstep(uCore * 0.6, uCore, d);
  vec3 c = mix(vCol.rgb * glow, vec3(1.0), core * 0.85);
  o = vec4(c, max(glow, core)) * vCol.a;
}`
const LS = 9 // floats per vertex: pos2 local2 len1 col4

/** Capsule-shaped glowing segments (round ends), built as quads on the CPU. */
export class GlowLines {
  private p: WebGLProgram
  private uCore: WebGLUniformLocation | null
  private vao: WebGLVertexArrayObject
  private buf: WebGLBuffer
  private data: Float32Array
  private n = 0
  private w = 1
  private h = 1
  constructor(private gl: WebGL2RenderingContext, private max: number) {
    this.p = program(gl, LINE_FS, LINE_VS)
    this.uCore = gl.getUniformLocation(this.p, 'uCore')
    this.data = new Float32Array(max * 6 * LS)
    this.vao = gl.createVertexArray()
    this.buf = gl.createBuffer()
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW)
    attrib(gl, this.p, 'aPos', 2, LS, 0)
    attrib(gl, this.p, 'aLocal', 2, LS, 2)
    attrib(gl, this.p, 'aLen', 1, LS, 4)
    attrib(gl, this.p, 'aCol', 4, LS, 5)
    gl.bindVertexArray(null)
  }
  begin(w: number, h: number): void { this.n = 0; this.w = w; this.h = h }
  get count(): number { return this.n }
  /** Segment a->b in pixels, `hw` = half width in pixels (includes the glow). */
  seg(ax: number, ay: number, bx: number, by: number, hw: number, r: number, g: number, b: number, a = 1): void {
    if (this.n >= this.max || hw <= 0) return
    let dx = bx - ax, dy = by - ay
    const len = Math.hypot(dx, dy)
    if (len > 1e-4) { dx /= len; dy /= len } else { dx = 1; dy = 0 }
    const nx = -dy * hw, ny = dx * hw, ex = dx * hw, ey = dy * hw
    const L = len / hw
    const sx = 2 / this.w, sy = 2 / this.h
    const d = this.data
    let o = this.n * 6 * LS
    const v = (x: number, y: number, lx: number, ly: number): void => {
      d[o++] = x * sx - 1; d[o++] = y * sy - 1; d[o++] = lx; d[o++] = ly; d[o++] = L
      d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a
    }
    const x0 = ax - ex, y0 = ay - ey, x1 = bx + ex, y1 = by + ey
    v(x0 + nx, y0 + ny, -1, 1); v(x0 - nx, y0 - ny, -1, -1); v(x1 + nx, y1 + ny, L + 1, 1)
    v(x1 + nx, y1 + ny, L + 1, 1); v(x0 - nx, y0 - ny, -1, -1); v(x1 - nx, y1 - ny, L + 1, -1)
    this.n++
  }
  /** Draw queued segments with the current blend state. `core` = white core radius (0..1 of hw). */
  draw(core = 0.3): void {
    if (!this.n) return
    const gl = this.gl
    gl.useProgram(this.p)
    gl.uniform1f(this.uCore, core)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * 6 * LS)
    gl.drawArrays(gl.TRIANGLES, 0, this.n * 6)
    gl.bindVertexArray(null)
  }
  dispose(): void {
    this.gl.deleteProgram(this.p)
    this.gl.deleteBuffer(this.buf)
    this.gl.deleteVertexArray(this.vao)
  }
}

// ---------------------------------------------------------------- glowing point sprites

const PT_VS = `#version 300 es
in vec2 aPos; in float aSize; in vec4 aCol;
out vec4 vCol;
void main() { vCol = aCol; gl_PointSize = aSize; gl_Position = vec4(aPos, 0.0, 1.0); }`
const PT_FS = `#version 300 es
precision mediump float;
in vec4 vCol; out vec4 o;
uniform float uShape;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  vec3 c; float a;
  if (uShape > 0.5) {
    // sparkle: soft glow + 4 thin rays + hot core
    float glow = exp(-r * r * 9.0);
    float rays = max(0.0, 1.0 - abs(p.x) * 14.0) * (1.0 - abs(p.y))
               + max(0.0, 1.0 - abs(p.y) * 14.0) * (1.0 - abs(p.x));
    float core = exp(-r * r * 45.0);
    c = vCol.rgb * (glow + rays * 0.8) + vec3(core + rays * 0.35);
    a = clamp(glow + rays, 0.0, 1.0);
  } else {
    // soft dot with white centre
    float glow = exp(-r * r * 5.0) * (1.0 - r);
    float core = 1.0 - smoothstep(0.22, 0.38, r);
    c = mix(vCol.rgb * glow, vec3(1.0), core * 0.8);
    a = max(glow, core);
  }
  o = vec4(c, a) * vCol.a;
}`
const PS = 7 // pos2 size1 col4

export const DOT = 0
export const SPARKLE = 1

export class GlowPoints {
  private p: WebGLProgram
  private uShape: WebGLUniformLocation | null
  private vao: WebGLVertexArrayObject
  private buf: WebGLBuffer
  private data: Float32Array
  private maxSize: number
  private n = 0
  private w = 1
  private h = 1
  constructor(private gl: WebGL2RenderingContext, private max: number) {
    this.p = program(gl, PT_FS, PT_VS)
    this.uShape = gl.getUniformLocation(this.p, 'uShape')
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null
    this.maxSize = range ? range[1] : 64
    this.data = new Float32Array(max * PS)
    this.vao = gl.createVertexArray()
    this.buf = gl.createBuffer()
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW)
    attrib(gl, this.p, 'aPos', 2, PS, 0)
    attrib(gl, this.p, 'aSize', 1, PS, 2)
    attrib(gl, this.p, 'aCol', 4, PS, 3)
    gl.bindVertexArray(null)
  }
  begin(w: number, h: number): void { this.n = 0; this.w = w; this.h = h }
  get count(): number { return this.n }
  /** Point at pixel (x, y), `size` = diameter in pixels. */
  point(x: number, y: number, size: number, r: number, g: number, b: number, a = 1): void {
    if (this.n >= this.max) return
    const d = this.data
    let o = this.n * PS
    d[o++] = (x / this.w) * 2 - 1; d[o++] = (y / this.h) * 2 - 1
    d[o++] = Math.min(size, this.maxSize)
    d[o++] = r; d[o++] = g; d[o++] = b; d[o++] = a
    this.n++
  }
  draw(shape: number = DOT): void {
    if (!this.n) return
    const gl = this.gl
    gl.useProgram(this.p)
    gl.uniform1f(this.uShape, shape)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * PS)
    gl.drawArrays(gl.POINTS, 0, this.n)
    gl.bindVertexArray(null)
  }
  dispose(): void {
    this.gl.deleteProgram(this.p)
    this.gl.deleteBuffer(this.buf)
    this.gl.deleteVertexArray(this.vao)
  }
}
