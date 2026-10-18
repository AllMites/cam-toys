import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'
import { OVAL, faceGeo, hex } from './_util'

// Polylines over MediaPipe face-mesh indices ("c" = closed loop).
const LINES: [number[], boolean][] = [
  [OVAL, true],
  [[61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185], true], // lips outer
  [[78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191], true], // lips inner
  [[33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], true],   // right eye
  [[263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466], true], // left eye
  [[46, 53, 52, 65, 55, 107, 66, 105, 63, 70], true],     // right brow
  [[276, 283, 282, 295, 285, 336, 296, 334, 293, 300], true], // left brow
  [[168, 6, 197, 195, 5, 4, 1, 19, 94, 2], false],          // nose bridge
  [[98, 97, 2, 326, 327], false],                           // nostrils
  [[129, 49, 48, 64, 98], false], [[358, 279, 278, 294, 327], false],
  [[469, 470, 471, 472], true], [[474, 475, 476, 477], true] // irises
]
const SEGS: number[] = []
for (const [l, closed] of LINES) {
  for (let i = 0; i + 1 < l.length; i++) SEGS.push(l[i], l[i + 1])
  if (closed) SEGS.push(l[l.length - 1], l[0])
}
// Techy spokes: nose tip → every other oval point.
OVAL.forEach((i, k) => { if (k % 2 === 0) SEGS.push(1, i) })
const NSEG = SEGS.length / 2

const LINE_VS = `#version 300 es
in vec3 aPos; uniform vec2 uRes;
out float vAcross; out vec2 vPx;
void main() { vAcross = aPos.z; vPx = aPos.xy; gl_Position = vec4(aPos.xy / uRes * 2.0 - 1.0, 0.0, 1.0); }`
const LINE_FS = `#version 300 es
precision mediump float;
in float vAcross; in vec2 vPx; out vec4 o;
uniform vec3 uColor; uniform vec2 uCenter, uUp; uniform float uH, uScan;
void main() {
  float d = abs(vAcross);
  float core = 1.0 - smoothstep(0.12, 0.3, d);
  float glow = (1.0 - d) * (1.0 - d) * 0.55;
  float s = dot(vPx - uCenter, uUp) / uH;
  float scan = exp(-(s - uScan) * (s - uScan) * 60.0) * 1.5;
  vec3 c = uColor * (glow + core) * (1.0 + scan) + vec3(core * 0.5 * (0.4 + scan));
  o = vec4(c, 1.0);
}`
const DOT_VS = `#version 300 es
in vec2 aPos; uniform vec2 uRes; uniform float uSize;
void main() { gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = uSize; }`
const DOT_FS = `#version 300 es
precision mediump float;
out vec4 o; uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  o = vec4(uColor * (1.0 - d) * 0.8, 1.0);
}`
const DIM_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform float uDim; uniform vec3 uColor;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, l * uColor * 0.6, uDim * 0.6) * (1.0 - 0.75 * uDim);
  o = vec4(c, 1.0);
}`

const faceMesh: FilterDef = {
  id: 'face-mesh', name: 'Face Mesh', category: 'face', icon: '🕸️',
  cost: 'medium', needs: ['face'],
  hint: 'Cyber-scan your face with a glowing wireframe.',
  params: {
    color: { type: 'color', label: 'Glow colour', default: '#33F0FF' },
    width: { type: 'range', label: 'Line glow', min: 0.5, max: 3, step: 0.05, default: 1.2 },
    dim: { type: 'range', label: 'Darken', min: 0, max: 1, step: 0.01, default: 0.35 }
  },
  create(gl) {
    const lp = program(gl, LINE_FS, LINE_VS), lu = uniforms(gl, lp)
    const dp = program(gl, DOT_FS, DOT_VS), du = uniforms(gl, dp)
    const bp = program(gl, DIM_FS), bu = uniforms(gl, bp)

    const lineData = new Float32Array(NSEG * 6 * 3)
    const lvao = gl.createVertexArray(), lbuf = gl.createBuffer()
    gl.bindVertexArray(lvao)
    gl.bindBuffer(gl.ARRAY_BUFFER, lbuf)
    gl.bufferData(gl.ARRAY_BUFFER, lineData.byteLength, gl.DYNAMIC_DRAW)
    const la = gl.getAttribLocation(lp, 'aPos')
    gl.enableVertexAttribArray(la)
    gl.vertexAttribPointer(la, 3, gl.FLOAT, false, 0, 0)

    const dotData = new Float32Array(478 * 2)
    const dvao = gl.createVertexArray(), dbuf = gl.createBuffer()
    gl.bindVertexArray(dvao)
    gl.bindBuffer(gl.ARRAY_BUFFER, dbuf)
    gl.bufferData(gl.ARRAY_BUFFER, dotData.byteLength, gl.DYNAMIC_DRAW)
    const da = gl.getAttribLocation(dp, 'aPos')
    gl.enableVertexAttribArray(da)
    gl.vertexAttribPointer(da, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    return {
      render(f, params) {
        const col = hex(String(params.color ?? '#33F0FF'))
        const g = faceGeo(f)
        gl.useProgram(bp)
        bindTexture(gl, 0, f.input, bu.uInput)
        gl.uniform1f(bu.uDim, g ? Number(params.dim ?? 0.35) : 0)
        gl.uniform3fv(bu.uColor, col)
        drawFullscreen(gl)
        if (!g) return

        const pts = g.pts, w = f.width, h = f.height
        const hw = Math.max(1.5, g.W * 0.012) * Number(params.width ?? 1.2)
        let o = 0, segs = 0
        for (let s = 0; s < NSEG; s++) {
          const ia = SEGS[s * 2], ib = SEGS[s * 2 + 1]
          if (ia >= pts.length || ib >= pts.length) continue
          const ax = pts[ia].x * w, ay = pts[ia].y * h, bx = pts[ib].x * w, by = pts[ib].y * h
          let dx = bx - ax, dy = by - ay
          const len = Math.hypot(dx, dy)
          if (len < 1e-3) continue
          dx /= len; dy /= len
          const nx = -dy * hw, ny = dx * hw
          const ex = dx * hw * 0.5, ey = dy * hw * 0.5
          const x0 = ax - ex, y0 = ay - ey, x1 = bx + ex, y1 = by + ey
          const L = lineData
          L[o++] = x0 + nx; L[o++] = y0 + ny; L[o++] = 1
          L[o++] = x0 - nx; L[o++] = y0 - ny; L[o++] = -1
          L[o++] = x1 + nx; L[o++] = y1 + ny; L[o++] = 1
          L[o++] = x1 + nx; L[o++] = y1 + ny; L[o++] = 1
          L[o++] = x0 - nx; L[o++] = y0 - ny; L[o++] = -1
          L[o++] = x1 - nx; L[o++] = y1 - ny; L[o++] = -1
          segs++
        }
        const n = Math.min(468, pts.length)
        for (let i = 0; i < n; i++) { dotData[i * 2] = pts[i].x * w; dotData[i * 2 + 1] = pts[i].y * h }

        const [cx, cy] = g.p(1)
        const scan = ((f.time * 0.6) % 1.6) * 2 - 1.6 // sweeps chin → forehead, with a pause
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)

        gl.useProgram(dp)
        gl.uniform2f(du.uRes, w, h)
        gl.uniform1f(du.uSize, Math.max(2, g.W * 0.012))
        gl.uniform3fv(du.uColor, col)
        gl.bindVertexArray(dvao)
        gl.bindBuffer(gl.ARRAY_BUFFER, dbuf)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, dotData, 0, n * 2)
        gl.drawArrays(gl.POINTS, 0, n)

        gl.useProgram(lp)
        gl.uniform2f(lu.uRes, w, h)
        gl.uniform3fv(lu.uColor, col)
        gl.uniform2f(lu.uCenter, cx, cy)
        gl.uniform2f(lu.uUp, -g.down[0], -g.down[1])
        gl.uniform1f(lu.uH, g.H * 0.6)
        gl.uniform1f(lu.uScan, scan)
        gl.bindVertexArray(lvao)
        gl.bindBuffer(gl.ARRAY_BUFFER, lbuf)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineData, 0, segs * 18)
        gl.drawArrays(gl.TRIANGLES, 0, segs * 6)
        gl.bindVertexArray(null)
      },
      dispose() {
        gl.deleteProgram(lp); gl.deleteProgram(dp); gl.deleteProgram(bp)
        gl.deleteBuffer(lbuf); gl.deleteBuffer(dbuf)
        gl.deleteVertexArray(lvao); gl.deleteVertexArray(dvao)
      }
    }
  }
}
export default faceMesh
