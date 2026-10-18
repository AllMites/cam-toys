import type { FilterDef } from '@engine/types'
import { bindTexture, copy, deleteTarget, drawFullscreen, program, uniforms, type Target } from '@engine/gl'
import { GAUSS_FS, hex, sized } from './_util'

// Edge of the silhouette at half res: max - min of the soft mask over a small ring.
const EDGE_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uMask; uniform vec2 uPx;
float m(vec2 p) { return smoothstep(0.3, 0.7, texture(uMask, p).r); }
void main() {
  float c = m(uv), lo = c, hi = c;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7853982;
    float v = m(uv + vec2(cos(a), sin(a)) * uPx * 2.0);
    lo = min(lo, v); hi = max(hi, v);
  }
  float e = hi - lo;
  o = vec4(e, e, e, 1.0);
}`

const COMP_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform sampler2D uEdge; uniform sampler2D uGlow;
uniform vec3 uColor; uniform float uPower;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  float e = texture(uEdge, uv).r;
  float g = texture(uGlow, uv).r;
  vec3 neon = uColor * (e * 1.3 + g * 2.2) + vec3(1.0) * smoothstep(0.5, 1.0, e) * 0.5;
  o = vec4(c + neon * uPower, 1.0);
}`

const def: FilterDef = {
  id: 'neon-outline', name: 'Neon Outline', category: 'body', icon: '✨',
  cost: 'heavy', needs: ['segment'],
  hint: 'You, outlined in glowing neon.',
  params: {
    color: { type: 'color', label: 'Colour', default: '#EC4899' },
    glow: { type: 'range', label: 'Glow', min: 0.5, max: 3, step: 0.1, default: 1.5 },
    pulse: { type: 'toggle', label: 'Pulse', default: true }
  },
  create(gl) {
    const pEdge = program(gl, EDGE_FS), uEdge = uniforms(gl, pEdge)
    const pBlur = program(gl, GAUSS_FS), uBlur = uniforms(gl, pBlur)
    const pComp = program(gl, COMP_FS), uComp = uniforms(gl, pComp)
    let edge: Target | null = null
    let a: Target | null = null
    let b: Target | null = null

    const pass = (dst: Target, src: Target, dx: number, dy: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
      bindTexture(gl, 0, src.tex, uBlur.uTex)
      gl.uniform2f(uBlur.uDir, dx, dy)
      drawFullscreen(gl)
    }

    return {
      render(f, params) {
        if (!f.mask) { copy(gl, f.input); return }
        const w = Math.max(1, f.width >> 1), h = Math.max(1, f.height >> 1)
        edge = sized(gl, edge, w, h)
        a = sized(gl, a, w, h)
        b = sized(gl, b, w, h)
        const glow = Number(params.glow ?? 1.5)

        gl.viewport(0, 0, w, h)
        gl.bindFramebuffer(gl.FRAMEBUFFER, edge.fbo)
        gl.useProgram(pEdge)
        bindTexture(gl, 0, f.mask, uEdge.uMask)
        gl.uniform2f(uEdge.uPx, 1 / w, 1 / h)
        drawFullscreen(gl)

        gl.useProgram(pBlur)
        pass(a, edge, glow / w, 0)
        pass(b, a, 0, glow / h)
        pass(a, b, (glow * 2.5) / w, 0)
        pass(b, a, 0, (glow * 2.5) / h)

        const pulse = Boolean(params.pulse ?? true) ? 0.75 + 0.35 * Math.sin(f.time * 4) : 1

        gl.bindFramebuffer(gl.FRAMEBUFFER, f.output)
        gl.viewport(0, 0, f.width, f.height)
        gl.useProgram(pComp)
        bindTexture(gl, 0, f.input, uComp.uInput)
        bindTexture(gl, 1, edge.tex, uComp.uEdge)
        bindTexture(gl, 2, b.tex, uComp.uGlow)
        gl.uniform3fv(uComp.uColor, hex(String(params.color ?? '#EC4899')))
        gl.uniform1f(uComp.uPower, pulse)
        drawFullscreen(gl)
      },
      dispose() {
        gl.deleteProgram(pEdge); gl.deleteProgram(pBlur); gl.deleteProgram(pComp)
        for (const t of [edge, a, b]) if (t) deleteTarget(gl, t)
      }
    }
  }
}
export default def
