import type { FilterDef } from '@engine/types'
import { copy, program, uniforms } from '@engine/gl'
import { blend, drawFromBase, faceGeo, makeSticker, mid, svgTex } from './_util'
import hatSvg from './assets/party-hat.svg?raw'

const VS = `#version 300 es
in vec2 aPos; in vec3 aCol; in vec2 aRS;
uniform vec2 uRes;
out vec3 vCol; out float vRot;
void main() {
  gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aRS.y;
  vCol = aCol; vRot = aRS.x;
}`
const FS = `#version 300 es
precision mediump float;
in vec3 vCol; in float vRot; out vec4 o;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  if (abs(p.x) > 0.4 || abs(p.y) > 0.2) discard;
  o = vec4(vCol, 1.0);
}`

const MAX = 400
const STRIDE = 7
const COLORS: [number, number, number][] = [
  [1, 0.35, 0.55], [1, 0.85, 0.2], [0.3, 0.85, 1], [0.6, 0.4, 1], [0.35, 0.95, 0.5], [1, 0.55, 0.2]
]

const partyHat: FilterDef = {
  id: 'party-hat', name: 'Party Hat', category: 'face', icon: '🥳',
  cost: 'medium', needs: ['face'],
  hint: 'Open your mouth to blast confetti!',
  params: {
    confetti: { type: 'range', label: 'Confetti', min: 0, max: 1, step: 0.01, default: 0.7 },
    size: { type: 'range', label: 'Hat size', min: 0.6, max: 1.5, step: 0.01, default: 1 }
  },
  create(gl) {
    const st = makeSticker(gl)
    const hat = svgTex(gl, hatSvg, 400, 540)
    const p = program(gl, FS, VS)
    const u = uniforms(gl, p)
    const vao = gl.createVertexArray()
    const buf = gl.createBuffer()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, MAX * STRIDE * 4, gl.DYNAMIC_DRAW)
    const attr = (name: string, size: number, off: number): void => {
      const l = gl.getAttribLocation(p, name)
      if (l < 0) return
      gl.enableVertexAttribArray(l)
      gl.vertexAttribPointer(l, size, gl.FLOAT, false, STRIDE * 4, off * 4)
    }
    attr('aPos', 2, 0); attr('aCol', 3, 2); attr('aRS', 2, 5)
    gl.bindVertexArray(null)

    // Particle state (struct of arrays), all in pixels.
    const px = new Float32Array(MAX), py = new Float32Array(MAX)
    const vx = new Float32Array(MAX), vy = new Float32Array(MAX)
    const life = new Float32Array(MAX), rot = new Float32Array(MAX), vr = new Float32Array(MAX)
    const size = new Float32Array(MAX), col = new Uint8Array(MAX)
    const gpu = new Float32Array(MAX * STRIDE)
    let next = 0, carry = 0

    return {
      render(f, params) {
        copy(gl, f.input)
        const g = faceGeo(f)
        const dt = Math.min(0.1, Math.max(0, f.dt))

        if (g) {
          const k = Number(params.size ?? 1)
          const t = hat.get()
          if (t) {
            const w = g.W * 0.72 * k
            drawFromBase(st, f, g, t, g.at(g.p(10), 0.1, -0.02), w, w * (540 / 400), 0.2)
          }
          const amt = Number(params.confetti ?? 0.7)
          const open = blend(f, 'jawOpen')
          if (amt > 0 && open > 0.3) {
            carry += dt * 220 * amt * Math.min(1, (open - 0.2) * 2)
            const [mx, my] = mid(g.p(13), g.p(14))
            const W = g.W
            while (carry >= 1) {
              carry -= 1
              const i = next
              next = (next + 1) % MAX
              const a = Math.random() * Math.PI * 2
              const sp = W * (0.6 + Math.random() * 1.4)
              px[i] = mx; py[i] = my
              vx[i] = Math.cos(a) * sp
              vy[i] = Math.sin(a) * sp * 0.7 - W * 0.9
              life[i] = 1.6 + Math.random() * 1.0
              rot[i] = Math.random() * 6.28
              vr[i] = (Math.random() - 0.5) * 14
              size[i] = W * (0.05 + Math.random() * 0.04)
              col[i] = (Math.random() * COLORS.length) | 0
            }
          } else carry = 0
        }

        let n = 0
        const grav = f.height * 1.1
        const drag = Math.exp(-1.6 * dt)
        for (let i = 0; i < MAX; i++) {
          if (life[i] <= 0) continue
          life[i] -= dt
          if (life[i] <= 0) continue
          vx[i] *= drag; vy[i] = vy[i] * drag + grav * dt
          px[i] += vx[i] * dt; py[i] += vy[i] * dt
          rot[i] += vr[i] * dt
          const c = COLORS[col[i]]
          const o = n * STRIDE
          gpu[o] = px[i]; gpu[o + 1] = py[i]
          gpu[o + 2] = c[0]; gpu[o + 3] = c[1]; gpu[o + 4] = c[2]
          gpu[o + 5] = rot[i]; gpu[o + 6] = size[i] * Math.min(1, life[i] * 2)
          n++
        }
        if (!n) return
        gl.disable(gl.BLEND)
        gl.useProgram(p)
        gl.uniform2f(u.uRes, f.width, f.height)
        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpu, 0, n * STRIDE)
        gl.drawArrays(gl.POINTS, 0, n)
        gl.bindVertexArray(null)
      },
      dispose() {
        st.dispose(); hat.dispose()
        gl.deleteProgram(p); gl.deleteBuffer(buf); gl.deleteVertexArray(vao)
      }
    }
  }
}
export default partyHat
