import type { FilterDef, Pt } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { hex, POSE_CONNECTIONS } from './_util'

// Each quad carries aLocal: lines use (0, ±1) across the width, joints use (±1, ±1) corners,
// so length(vLocal) is the distance from the bone/joint centre in both cases.
const VS = `#version 300 es
in vec2 aPos; in vec2 aLocal; out vec2 vLocal;
void main() { vLocal = aLocal; gl_Position = vec4(aPos, 0.0, 1.0); }`
const FS = `#version 300 es
precision mediump float;
in vec2 vLocal; out vec4 o; uniform vec3 uColor;
void main() {
  float d = length(vLocal);
  if (d > 1.0) discard;
  float glow = exp(-d * d * 5.0) * (1.0 - d);
  float core = 1.0 - smoothstep(0.16, 0.3, d);
  o = vec4(uColor * glow * 0.9 + mix(uColor, vec3(1.0), 0.7) * core * 0.8, 1.0);
}`
const DIM_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o; uniform sampler2D uInput;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  o = vec4(mix(c, vec3(l) * vec3(0.35, 0.5, 0.7), 0.6) * 0.35, 1.0);
}`

const FLOATS_PER_QUAD = 6 * 4 // 6 verts × (x, y, lx, ly)
const MAX_QUADS = POSE_CONNECTIONS.length + 33

const ok = (p: Pt | undefined): p is Pt => !!p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1

const def: FilterDef = {
  id: 'skeleton', name: 'Skeleton', category: 'body', icon: '🦴',
  cost: 'medium', needs: ['pose'],
  hint: 'Step back so your whole body fits — then dance!',
  params: {
    color: { type: 'color', label: 'Colour', default: '#3BE8FF' },
    thickness: { type: 'range', label: 'Thickness', min: 4, max: 24, step: 1, default: 12 },
    dark: { type: 'toggle', label: 'Dark background', default: true }
  },
  create(gl) {
    const p = program(gl, FS, VS)
    const u = uniforms(gl, p)
    const pDim = program(gl, DIM_FS)
    const uDim = uniforms(gl, pDim)
    const verts = new Float32Array(MAX_QUADS * FLOATS_PER_QUAD)
    const vao = gl.createVertexArray()
    const buf = gl.createBuffer()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW)
    const aPos = gl.getAttribLocation(p, 'aPos')
    const aLocal = gl.getAttribLocation(p, 'aLocal')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(aLocal)
    gl.vertexAttribPointer(aLocal, 2, gl.FLOAT, false, 16, 8)
    gl.bindVertexArray(null)

    let n = 0 // floats written
    let W = 1, H = 1
    const vert = (px: number, py: number, lx: number, ly: number) => {
      verts[n++] = (px / W) * 2 - 1; verts[n++] = (py / H) * 2 - 1
      verts[n++] = lx; verts[n++] = ly
    }
    // quad from corners (a,b,c,d) = (a+n, a-n, b+n, b-n) style ordering
    const quad = (
      x0: number, y0: number, l0x: number, l0y: number,
      x1: number, y1: number, l1x: number, l1y: number,
      x2: number, y2: number, l2x: number, l2y: number,
      x3: number, y3: number, l3x: number, l3y: number
    ) => {
      vert(x0, y0, l0x, l0y); vert(x1, y1, l1x, l1y); vert(x2, y2, l2x, l2y)
      vert(x2, y2, l2x, l2y); vert(x1, y1, l1x, l1y); vert(x3, y3, l3x, l3y)
    }

    return {
      render(f, params) {
        const dark = Boolean(params.dark ?? true)
        if (dark) {
          gl.useProgram(pDim)
          bindTexture(gl, 0, f.input, uDim.uInput)
          drawFullscreen(gl)
        } else {
          copy(gl, f.input)
        }
        const pts = f.pose?.poses[0]
        if (!pts || pts.length < 33) return

        W = f.width; H = f.height; n = 0
        const hw = Number(params.thickness ?? 12) * (H / 720)
        for (const [i, j] of POSE_CONNECTIONS) {
          const a = pts[i], b = pts[j]
          if (!ok(a) || !ok(b)) continue
          const ax = a.x * W, ay = a.y * H, bx = b.x * W, by = b.y * H
          const dx = bx - ax, dy = by - ay
          const len = Math.hypot(dx, dy)
          if (len < 0.5) continue
          const w = i <= 10 && j <= 10 ? hw * 0.6 : hw
          const nx = (-dy / len) * w, ny = (dx / len) * w
          quad(ax + nx, ay + ny, 0, 1, ax - nx, ay - ny, 0, -1,
               bx + nx, by + ny, 0, 1, bx - nx, by - ny, 0, -1)
        }
        for (let k = 0; k < 33; k++) {
          const c = pts[k]
          if (!ok(c)) continue
          const r = hw * (k <= 10 ? 0.8 : 1.5)
          const cx = c.x * W, cy = c.y * H
          quad(cx - r, cy - r, -1, -1, cx + r, cy - r, 1, -1,
               cx - r, cy + r, -1, 1, cx + r, cy + r, 1, 1)
        }
        if (!n) return

        gl.useProgram(p)
        gl.uniform3fv(u.uColor, hex(String(params.color ?? '#3BE8FF')))
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts, 0, n)
        gl.drawArrays(gl.TRIANGLES, 0, n / 4)
        gl.bindVertexArray(null)
        gl.disable(gl.BLEND)
      },
      dispose() {
        gl.deleteProgram(p)
        gl.deleteProgram(pDim)
        gl.deleteBuffer(buf)
        gl.deleteVertexArray(vao)
      }
    }
  }
}
export default def
