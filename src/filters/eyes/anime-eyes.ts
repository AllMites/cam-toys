import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { approach, eyes, face } from './_util'

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform float uAspect, uAmt, uSparkle;
uniform vec2 uC[2];
uniform float uRad[2];
uniform vec2 uI[2];
uniform float uR[2];
void main() {
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec2 s = p;
  for (int i = 0; i < 2; i++) {
    vec2 q = s - uC[i];
    float d = length(q) / uRad[i];
    if (d < 1.0) {
      float k = 1.0 - d * d;
      s = uC[i] + q * (1.0 - uAmt * k * k);
    }
  }
  vec3 c = texture(uInput, vec2(s.x / uAspect, s.y)).rgb;
  // catch-light sparkles, placed where the enlarged iris now appears
  float inv = 1.0 / max(1.0 - uAmt, 0.2);
  for (int i = 0; i < 2; i++) {
    vec2 ic = uC[i] + (uI[i] - uC[i]) * inv;
    float r = uR[i] * inv;
    float h1 = 1.0 - smoothstep(0.22, 0.3, length(p - (ic + vec2(-0.35, -0.38) * r)) / r);
    float h2 = 1.0 - smoothstep(0.1, 0.15, length(p - (ic + vec2(0.3, 0.32) * r)) / r);
    c = mix(c, vec3(1.0), max(h1, h2 * 0.85) * uSparkle);
  }
  o = vec4(c, 1.0);
}`

const animeEyes: FilterDef = {
  id: 'anime-eyes', name: 'Anime Eyes', category: 'eyes', icon: '🥺',
  cost: 'medium', needs: ['face'],
  hint: 'Huge sparkly anime eyes!',
  params: {
    amount: { type: 'range', label: 'Eye size', min: 0, max: 0.6, step: 0.01, default: 0.35 },
    sparkle: { type: 'toggle', label: 'Sparkles', default: true }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    const c = new Float32Array(4), rad = new Float32Array(2), ii = new Float32Array(4), r = new Float32Array(2)
    let open = 1
    return {
      render(f, params) {
        const fc = face(f)
        if (!fc) { copy(gl, f.input); return }
        const a = f.width / f.height
        const e = eyes(fc.pts, a)
        const blink = ((fc.bs.eyeBlinkLeft ?? 0) + (fc.bs.eyeBlinkRight ?? 0)) / 2
        open = approach(open, blink > 0.5 ? 0 : 1, f.dt, 20)
        for (let i = 0; i < 2; i++) {
          c[i * 2] = e[i].c[0]; c[i * 2 + 1] = e[i].c[1]
          rad[i] = e[i].halfW * 1.9
          ii[i * 2] = e[i].iris[0]; ii[i * 2 + 1] = e[i].iris[1]
          r[i] = e[i].r
        }
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAspect, a)
        gl.uniform1f(u.uAmt, Math.min(0.75, Math.max(0, Number(params.amount ?? 0.35))))
        gl.uniform1f(u.uSparkle, Boolean(params.sparkle ?? true) ? open : 0)
        gl.uniform2fv(u.uC, c)
        gl.uniform1fv(u.uRad, rad)
        gl.uniform2fv(u.uI, ii)
        gl.uniform1fv(u.uR, r)
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default animeEyes
