import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { eyes, face, hex } from './_util'

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform float uAspect, uAmt;
uniform vec2 uI[2];
uniform float uR[2];
uniform vec2 uC[2];
uniform vec2 uAx[2];
uniform vec2 uHalf[2];
uniform vec3 uColor;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float L = dot(c, vec3(0.299, 0.587, 0.114));
  float tl = max(dot(uColor, vec3(0.299, 0.587, 0.114)), 0.15);
  vec3 tint = clamp(uColor * (L * 1.5 + 0.08) / tl, 0.0, 1.0);
  float m = 0.0;
  for (int i = 0; i < 2; i++) {
    // inside the eye opening (ellipse from corners + lids)
    vec2 e = p - uC[i];
    vec2 ax = uAx[i];
    vec2 ell = vec2(dot(e, ax) / uHalf[i].x, dot(e, vec2(-ax.y, ax.x)) / uHalf[i].y);
    float em = 1.0 - smoothstep(0.75, 1.0, length(ell));
    // iris ring, keeping the pupil dark
    float d = length(p - uI[i]) / uR[i];
    float im = 1.0 - smoothstep(0.85, 1.05, d);
    float pupil = smoothstep(0.28, 0.42, d);
    m = max(m, em * im * pupil);
  }
  o = vec4(mix(c, tint, m * uAmt), 1.0);
}`

const irisRecolor: FilterDef = {
  id: 'iris-recolor', name: 'Eye Colour', category: 'eyes', icon: '👁️',
  cost: 'medium', needs: ['face'],
  hint: 'Try on a brand new eye colour.',
  params: {
    color: { type: 'color', label: 'Eye colour', default: '#2FA8FF' },
    amount: { type: 'range', label: 'Strength', min: 0, max: 1, step: 0.01, default: 0.75 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    const ii = new Float32Array(4), r = new Float32Array(2), c = new Float32Array(4)
    const ax = new Float32Array(4), half = new Float32Array(4)
    return {
      render(f, params) {
        const fc = face(f)
        if (!fc) { copy(gl, f.input); return }
        const a = f.width / f.height
        const e = eyes(fc.pts, a)
        for (let i = 0; i < 2; i++) {
          const k = i * 2
          ii[k] = e[i].iris[0]; ii[k + 1] = e[i].iris[1]; r[i] = e[i].r
          c[k] = e[i].c[0]; c[k + 1] = e[i].c[1]
          ax[k] = e[i].axis[0]; ax[k + 1] = e[i].axis[1]
          half[k] = e[i].halfW; half[k + 1] = Math.max(e[i].halfH * 1.15, 0.0005)
        }
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAspect, a)
        gl.uniform1f(u.uAmt, Number(params.amount ?? 0.75))
        gl.uniform2fv(u.uI, ii)
        gl.uniform1fv(u.uR, r)
        gl.uniform2fv(u.uC, c)
        gl.uniform2fv(u.uAx, ax)
        gl.uniform2fv(u.uHalf, half)
        gl.uniform3fv(u.uColor, hex(String(params.color ?? '#2FA8FF')))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default irisRecolor
