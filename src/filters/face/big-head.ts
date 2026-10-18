import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { approach, faceGeo, mid } from './_util'

// Radial warp around the head: src radius s(d) = d * (1 - a * (1 - d²)), d = r / R in [0, 1].
// a > 0 magnifies the centre by 1 / (1 - a); a < 0 shrinks it. Monotonic for |a| <= 0.5.
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform vec2 uRes, uCenter, uAxis;
uniform float uR, uA;
void main() {
  vec2 px = uv * uRes;
  vec2 d = px - uCenter;
  // Slightly taller than wide: stretch along the head's up axis.
  vec2 side = vec2(-uAxis.y, uAxis.x);
  vec2 q = vec2(dot(d, side), dot(d, uAxis) / 1.2);
  float r = length(q) / uR;
  vec2 src = px;
  if (r < 1.0) {
    float s = 1.0 - uA * (1.0 - r * r);
    src = uCenter + d * s;
  }
  o = texture(uInput, src / uRes);
}`

const bigHead: FilterDef = {
  id: 'big-head', name: 'Big Head', category: 'face', icon: '🎃',
  cost: 'medium', needs: ['face'],
  hint: 'Bobblehead mode! Slide left for a teeny tiny face.',
  params: {
    amount: { type: 'range', label: 'Tiny ↔ Big', min: -1, max: 1, step: 0.01, default: 0.7 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    let cx = 0, cy = 0, R = 0, has = false
    return {
      render(f, params) {
        const g = faceGeo(f)
        if (!g) { has = false; copy(gl, f.input); return }
        const c = g.at(mid(g.p(10), g.p(152)), 0, -0.12)
        const r = Math.max(g.W, g.H) * 0.95
        // Light smoothing so the warp doesn't jitter with landmark noise.
        if (!has) { cx = c[0]; cy = c[1]; R = r; has = true }
        cx = approach(cx, c[0], 25, f.dt); cy = approach(cy, c[1], 25, f.dt); R = approach(R, r, 15, f.dt)
        const amt = Math.max(-1, Math.min(1, Number(params.amount ?? 0.7)))
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform2f(u.uRes, f.width, f.height)
        gl.uniform2f(u.uCenter, cx, cy)
        gl.uniform2f(u.uAxis, -g.down[0], -g.down[1])
        gl.uniform1f(u.uR, R)
        gl.uniform1f(u.uA, amt * (amt > 0 ? 0.42 : 0.5))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default bigHead
