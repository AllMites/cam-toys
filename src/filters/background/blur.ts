import type { FilterDef } from '@engine/types'
import { bindTexture, copy, deleteTarget, drawFullscreen, program, uniforms, type Target } from '@engine/gl'
import { GAUSS_FS, sized } from './_util'

// Downsample to half res, weighting each pixel by "background-ness" (premultiplied, alpha =
// weight) so the person doesn't bleed a halo into the blurred background.
const DOWN_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform sampler2D uMask;
void main() {
  float w = 1.0 - smoothstep(0.3, 0.7, texture(uMask, uv).r);
  o = vec4(texture(uInput, uv).rgb * w, w);
}`

const COMP_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform sampler2D uMask; uniform sampler2D uBlur;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  vec4 b = texture(uBlur, uv);
  vec3 bg = b.a > 0.02 ? b.rgb / b.a : c;
  float m = smoothstep(0.3, 0.7, texture(uMask, uv).r);
  o = vec4(mix(bg, c, m), 1.0);
}`

const def: FilterDef = {
  id: 'blur', name: 'Blur Background', category: 'background', icon: '🌫️',
  cost: 'medium', needs: ['segment'],
  hint: 'Hide the messy room — you stay sharp.',
  params: {
    strength: { type: 'range', label: 'Blur', min: 0.5, max: 4, step: 0.1, default: 2 }
  },
  create(gl) {
    const pDown = program(gl, DOWN_FS), uDown = uniforms(gl, pDown)
    const pBlur = program(gl, GAUSS_FS), uBlur = uniforms(gl, pBlur)
    const pComp = program(gl, COMP_FS), uComp = uniforms(gl, pComp)
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
        a = sized(gl, a, w, h)
        b = sized(gl, b, w, h)
        const s = Number(params.strength ?? 2)

        gl.viewport(0, 0, w, h)
        gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo)
        gl.useProgram(pDown)
        bindTexture(gl, 0, f.input, uDown.uInput)
        bindTexture(gl, 1, f.mask, uDown.uMask)
        drawFullscreen(gl)

        gl.useProgram(pBlur)
        for (let i = 0; i < 2; i++) {
          const k = s * (i + 1)
          pass(b, a, k / w, 0)
          pass(a, b, 0, k / h)
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, f.output)
        gl.viewport(0, 0, f.width, f.height)
        gl.useProgram(pComp)
        bindTexture(gl, 0, f.input, uComp.uInput)
        bindTexture(gl, 1, f.mask, uComp.uMask)
        bindTexture(gl, 2, a.tex, uComp.uBlur)
        drawFullscreen(gl)
      },
      dispose() {
        gl.deleteProgram(pDown); gl.deleteProgram(pBlur); gl.deleteProgram(pComp)
        if (a) deleteTarget(gl, a)
        if (b) deleteTarget(gl, b)
      }
    }
  }
}
export default def
