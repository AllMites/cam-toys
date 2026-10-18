import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { approach, face, mouth } from '../eyes/_util'

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform float uAspect, uTime, uS, uLen, uW, uFlame;
uniform vec2 uO, uD;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * n(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return v;
}
vec3 ramp(float x) {
  return vec3(1.0, 0.22, 0.0) * smoothstep(0.0, 0.4, x)
       + vec3(0.0, 0.62, 0.0) * smoothstep(0.3, 0.7, x)
       + vec3(0.0, 0.16, 0.65) * smoothstep(0.7, 1.0, x);
}
void main() {
  vec3 c = texture(uInput, uv).rgb;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec2 q = p - uO;
  float along = dot(q, uD);
  float across = dot(q, vec2(-uD.y, uD.x));
  float w = uW * 0.35 + max(along, 0.0) * 0.45;
  float x = across / w;
  float t = along / max(uLen, 1e-3);
  float nz = fbm(vec2(along * 10.0 - uTime * 7.0, across * 7.0 / (0.25 + max(along, 0.0))));
  float shape = clamp(1.0 - abs(x), 0.0, 1.0);
  float heat = shape * 1.5 - t * 0.9 + (nz - 0.5) * 1.4;
  heat *= smoothstep(0.0, uW * 0.1, along) * step(0.0, along) * (1.0 - smoothstep(0.75, 1.0, t));
  heat = clamp(heat, 0.0, 1.0) * uS;
  vec3 fire = ramp(heat);
  if (uFlame > 1.5) fire = fire.grb; else if (uFlame > 0.5) fire = fire.bgr;
  float a = smoothstep(0.05, 0.35, heat);
  // warm light spill on the face around the mouth
  float glow = exp(-dot(q, q) / (uW * uW * 3.0)) * 0.35 * uS;
  vec3 tint = uFlame > 1.5 ? vec3(0.3, 1.0, 0.2) : (uFlame > 0.5 ? vec3(0.2, 0.5, 1.0) : vec3(1.0, 0.45, 0.1));
  c += tint * glow;
  c = c * (1.0 - a * 0.65) + fire * a * 1.25;
  o = vec4(c, 1.0);
}`

const FLAMES = ['Classic', 'Blue', 'Green']

const fireBreath: FilterDef = {
  id: 'expr-fire-breath', name: 'Fire Breath', category: 'face', icon: '🔥',
  cost: 'medium', needs: ['face'],
  hint: 'Open your mouth to breathe fire!',
  params: {
    flame: { type: 'select', label: 'Flame', options: FLAMES, default: 'Classic' },
    size: { type: 'range', label: 'Size', min: 0.5, max: 2, step: 0.05, default: 1 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    let s = 0, length = 0
    return {
      render(f, params) {
        const fc = face(f)
        const jaw = fc?.bs.jawOpen ?? 0
        const on = jaw > 0.3
        s = approach(s, on ? Math.min(1, 0.6 + jaw) : 0, f.dt, on ? 12 : 6)
        length = on ? Math.min(1.2, length + f.dt * 4) : (s < 0.03 ? 0 : length)
        if (!fc || s < 0.01) { copy(gl, f.input); return }
        const a = f.width / f.height
        const m = mouth(fc.pts, a)
        const size = Number(params.size ?? 1)
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAspect, a)
        gl.uniform1f(u.uTime, f.time % 600)
        gl.uniform1f(u.uS, s)
        gl.uniform1f(u.uLen, Math.max(0.02, length * size))
        gl.uniform1f(u.uW, m.w * size)
        gl.uniform1f(u.uFlame, Math.max(0, FLAMES.indexOf(String(params.flame ?? 'Classic'))))
        gl.uniform2f(u.uO, m.c[0], m.c[1])
        gl.uniform2f(u.uD, m.dir[0], m.dir[1])
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default fireBreath
