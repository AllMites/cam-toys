import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { approach, eyes, face, hex } from './_util'

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform float uAspect, uTime, uPower, uSize;
uniform vec2 uI[2];
uniform float uR[2];
uniform vec3 uColor;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec3 acc = vec3(0.0);
  float cover = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 q = p - uI[i];
    float d = length(q) / uR[i];
    float core = 1.0 - smoothstep(0.4, 1.15, d);
    float ds = d / uSize;
    float bloom = exp(-ds * ds * 0.12) * 0.7 + exp(-ds * 0.45) * 0.35;
    float ang = atan(q.y, q.x);
    float rays = pow(abs(cos(ang * 2.0 + uTime * 0.7)), 60.0) * exp(-ds * 0.25) * 0.6;
    float pulse = 0.9 + 0.1 * sin(uTime * 4.0 + float(i));
    acc += uColor * (bloom + rays) * pulse + mix(uColor, vec3(1.0), 0.6) * core * 1.2;
    cover = max(cover, core);
  }
  c = c * (1.0 - cover * 0.6 * uPower) + acc * uPower;
  o = vec4(c, 1.0);
}`

const glowingEyes: FilterDef = {
  id: 'glowing-eyes', name: 'Glowing Eyes', category: 'eyes', icon: '✨',
  cost: 'medium', needs: ['face'],
  hint: 'Your eyes glow with spooky magic.',
  params: {
    color: { type: 'color', label: 'Glow colour', default: '#33E0FF' },
    size: { type: 'range', label: 'Glow size', min: 0.4, max: 3, step: 0.05, default: 1.2 },
    power: { type: 'range', label: 'Brightness', min: 0.1, max: 1.5, step: 0.05, default: 1 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    const ii = new Float32Array(4), r = new Float32Array(2)
    let open = 1
    return {
      render(f, params) {
        const fc = face(f)
        if (!fc) { copy(gl, f.input); return }
        const a = f.width / f.height
        const e = eyes(fc.pts, a)
        const blink = ((fc.bs.eyeBlinkLeft ?? 0) + (fc.bs.eyeBlinkRight ?? 0)) / 2
        open = approach(open, blink > 0.55 ? 0.15 : 1, f.dt, 15)
        for (let i = 0; i < 2; i++) {
          ii[i * 2] = e[i].iris[0]; ii[i * 2 + 1] = e[i].iris[1]; r[i] = e[i].r
        }
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAspect, a)
        gl.uniform1f(u.uTime, f.time)
        gl.uniform1f(u.uPower, Number(params.power ?? 1) * open)
        gl.uniform1f(u.uSize, Number(params.size ?? 1.2))
        gl.uniform2fv(u.uI, ii)
        gl.uniform1fv(u.uR, r)
        gl.uniform3fv(u.uColor, hex(String(params.color ?? '#33E0FF')))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default glowingEyes
