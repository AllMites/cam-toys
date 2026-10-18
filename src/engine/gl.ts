// Small WebGL2 helpers shared by the engine and filter authors. See docs/ADDING_A_FILTER.md.
//
// Orientation rule: every engine texture stores row 0 = image TOP. So a landmark's (x, y)
// is directly a texture uv, and in an engine FBO its clip position is (x*2-1, y*2-1).
import type { Pt } from './types'

/** Vertex shader for one fullscreen triangle; gives `uv` (0..1, v=0 is the image top). */
export const FULLSCREEN_VS = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

function shader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error(`shader compile failed: ${log}`)
  }
  return s
}

/** Compile + link. `fs` alone gives a fullscreen pass (pair with drawFullscreen). */
export function program(gl: WebGL2RenderingContext, fs: string, vs = FULLSCREEN_VS): WebGLProgram {
  const p = gl.createProgram()
  const v = shader(gl, gl.VERTEX_SHADER, vs)
  const f = shader(gl, gl.FRAGMENT_SHADER, fs)
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p)
    gl.deleteProgram(p)
    throw new Error(`program link failed: ${log}`)
  }
  return p
}

/** Every active uniform's location by name, e.g. `u.uTime`. */
export function uniforms(gl: WebGL2RenderingContext, p: WebGLProgram): Record<string, WebGLUniformLocation> {
  const out: Record<string, WebGLUniformLocation> = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i)!.name.replace(/\[0\]$/, '')
    out[name] = gl.getUniformLocation(p, name)!
  }
  return out
}

const emptyVao = new WeakMap<WebGL2RenderingContext, WebGLVertexArrayObject>()

/** Draw the fullscreen triangle with the currently bound program. */
export function drawFullscreen(gl: WebGL2RenderingContext): void {
  let vao = emptyVao.get(gl)
  if (!vao) emptyVao.set(gl, (vao = gl.createVertexArray()))
  gl.bindVertexArray(vao)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

/** Bind `tex` to texture `unit` and point sampler uniform `loc` at it. */
export function bindTexture(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture, loc: WebGLUniformLocation): void {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.uniform1i(loc, unit)
}

/** RGBA8 texture (linear, clamped), left bound to TEXTURE_2D. Filled from `src` if given. */
export function texture(gl: WebGL2RenderingContext, src?: TexImageSource): WebGLTexture {
  const t = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src)
  return t
}

/** Load an image URL (e.g. `import url from './assets/hat.png?url'`) into a texture. */
export async function textureFromUrl(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
  const img = new Image()
  img.src = url
  await img.decode()
  return texture(gl, img)
}

/** Rasterize SVG markup (e.g. `import svg from './assets/hat.svg?raw'`) at w×h into a texture. */
export function textureFromSvg(gl: WebGL2RenderingContext, svg: string, w: number, h: number): Promise<WebGLTexture> {
  const c = new OffscreenCanvas(w, h)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const img = new Image(w, h)
  img.src = url
  return img.decode().then(() => {
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return texture(gl, c)
  }).finally(() => URL.revokeObjectURL(url))
}

/** Draw into a 2D canvas (text, emoji, paths) and upload it as a texture. */
export function textureFromCanvas(gl: WebGL2RenderingContext, w: number, h: number, draw: (ctx: OffscreenCanvasRenderingContext2D) => void): WebGLTexture {
  const c = new OffscreenCanvas(w, h)
  draw(c.getContext('2d')!)
  return texture(gl, c)
}

export interface Target { tex: WebGLTexture; fbo: WebGLFramebuffer; width: number; height: number }

/** Texture + framebuffer pair (for your own intermediate passes). Free with deleteTarget. */
export function target(gl: WebGL2RenderingContext, width: number, height: number): Target {
  const tex = texture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  return { tex, fbo, width, height }
}
export function deleteTarget(gl: WebGL2RenderingContext, t: Target): void {
  gl.deleteFramebuffer(t.fbo)
  gl.deleteTexture(t.tex)
}

const blitProg = new WeakMap<WebGL2RenderingContext, { p: WebGLProgram; u: Record<string, WebGLUniformLocation> }>()

/**
 * Draw `tex` over the bound framebuffer. `scaleX/scaleY = -1` mirrors that axis.
 * Filters: `copy(gl, f.input)` first, then draw your overlay on top.
 */
export function copy(gl: WebGL2RenderingContext, tex: WebGLTexture, scaleX = 1, scaleY = 1): void {
  let b = blitProg.get(gl)
  if (!b) {
    const p = program(gl, `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uScale;
void main() { o = texture(uTex, (uv - 0.5) * uScale + 0.5); }`)
    blitProg.set(gl, (b = { p, u: uniforms(gl, p) }))
  }
  gl.useProgram(b.p)
  bindTexture(gl, 0, tex, b.u.uTex)
  gl.uniform2f(b.u.uScale, scaleX, scaleY)
  drawFullscreen(gl)
}

/** Landmark (normalised, un-mirrored) → clip space of an engine FBO. */
export function toClip(p: Pt): [number, number] {
  return [p.x * 2 - 1, p.y * 2 - 1]
}

/** Landmark → pixel coords in a w×h frame (y down). */
export function toPixels(p: Pt, w: number, h: number): [number, number] {
  return [p.x * w, p.y * h]
}
