import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { approach, asp, dist, dot, eyes, face, hex, mid, norm, sub, type V2 } from './_util'

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform float uAspect, uTime, uPower, uWidth, uLen;
uniform vec2 uO[2];
uniform vec2 uD[2];
uniform float uR[2];
uniform vec3 uColor;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec2 q = p - uO[i];
    float t = clamp(dot(q, uD[i]), 0.0, uLen);
    float d = length(q - uD[i] * t);
    float w = uR[i] * uWidth * (1.0 + 2.0 * t);
    float flick = 0.85 + 0.15 * sin(uTime * 45.0 + float(i) * 2.1 - t * 40.0);
    float fade = 1.0 - smoothstep(uLen * 0.6, uLen, t);
    float core = exp(-d * d / (w * w * 0.12));
    float glow = exp(-d * d / (w * w * 1.6));
    acc += (uColor * glow * 1.1 + vec3(1.0) * core) * fade * flick;
    // flare + horizontal streak at the iris
    float fd = length(q);
    float rr = uR[i];
    float flare = exp(-fd * fd / (rr * rr * 3.0));
    float streak = exp(-abs(q.y) / (rr * 0.18)) * exp(-abs(q.x) / (rr * 5.0));
    acc += uColor * (flare * 1.3 + streak * 0.8) + vec3(1.0) * flare * flare;
  }
  o = vec4(c + acc * uPower, 1.0);
}`

const laserEyes: FilterDef = {
  id: 'laser-eyes', name: 'Laser Eyes', category: 'eyes', icon: '👀',
  cost: 'medium', needs: ['face'],
  hint: 'Open your eyes wide to power up the lasers!',
  params: {
    color: { type: 'color', label: 'Laser colour', default: '#FF2020' },
    length: { type: 'range', label: 'Beam length', min: 0.2, max: 2, step: 0.05, default: 1.4 },
    width: { type: 'range', label: 'Beam width', min: 0.3, max: 2.5, step: 0.05, default: 1 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    const o = new Float32Array(4), d = new Float32Array(4), r = new Float32Array(2)
    let wide = 0, open = 1
    return {
      render(f, params) {
        const fc = face(f)
        if (!fc) { copy(gl, f.input); return }
        const a = f.width / f.height
        const { pts, bs } = fc
        const e = eyes(pts, a)
        const wideT = Math.min(1, Math.max(0, (Math.max(bs.eyeWideLeft ?? 0, bs.eyeWideRight ?? 0) - 0.08) / 0.4))
        const blink = ((bs.eyeBlinkLeft ?? 0) + (bs.eyeBlinkRight ?? 0)) / 2
        wide = approach(wide, wideT, f.dt, 8)
        open = approach(open, blink > 0.55 ? 0 : 1, f.dt, 18)

        // face frame: `right` from eye 0 to eye 1, `down` towards the nose
        const right = norm(sub(e[1].iris, e[0].iris))
        let down: V2 = [-right[1], right[0]]
        const midEyes = mid(e[0].iris, e[1].iris)
        if (dot(down, sub(asp(pts[1], a), midEyes)) < 0) down = [-down[0], -down[1]]
        const cheek0 = asp(pts[234], a), cheek1 = asp(pts[454], a)
        const faceW = Math.max(dist(cheek0, cheek1), 1e-3)
        const yaw = dot(sub(asp(pts[1], a), mid(cheek0, cheek1)), right) / faceW
        for (let i = 0; i < 2; i++) {
          const out = (i === 0 ? -0.8 : 0.8) + yaw * 3
          const dir = norm([right[0] * out + down[0] * 0.3, right[1] * out + down[1] * 0.3])
          o[i * 2] = e[i].iris[0]; o[i * 2 + 1] = e[i].iris[1]
          d[i * 2] = dir[0]; d[i * 2 + 1] = dir[1]
          r[i] = e[i].r
        }

        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAspect, a)
        gl.uniform1f(u.uTime, f.time)
        gl.uniform1f(u.uPower, (0.5 + 0.8 * wide) * open)
        gl.uniform1f(u.uWidth, Number(params.width ?? 1) * 0.8 * (1 + 0.4 * wide))
        gl.uniform1f(u.uLen, Number(params.length ?? 1.4))
        gl.uniform2fv(u.uO, o)
        gl.uniform2fv(u.uD, d)
        gl.uniform1fv(u.uR, r)
        gl.uniform3fv(u.uColor, hex(String(params.color ?? '#FF2020')))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default laserEyes
