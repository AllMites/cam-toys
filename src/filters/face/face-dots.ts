import type { FilterDef } from '@engine/types'
import { copy, program, uniforms } from '@engine/gl'

// Points are already in engine clip space: x*2-1, y*2-1 (see toClip in gl.ts).
const VS = `#version 300 es
in vec2 aPos; uniform float uSize;
void main() { gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = uSize; }`
const FS = `#version 300 es
precision mediump float;
out vec4 o; uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  o = vec4(uColor, 1.0 - smoothstep(0.35, 0.5, d));
}`

const hex = (s: string): [number, number, number] => {
  const n = parseInt(s.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const faceDots: FilterDef = {
  id: 'face-dots', name: 'Face Dots', category: 'face', icon: '🔵',
  cost: 'medium', needs: ['face'],
  hint: 'Shows the 478 face-tracking points.',
  params: {
    color: { type: 'color', label: 'Colour', default: '#3BE8FF' },
    size: { type: 'range', label: 'Dot size', min: 1, max: 8, step: 0.5, default: 3 }
  },
  create(gl) {
    const p = program(gl, FS, VS)
    const u = uniforms(gl, p)
    const vao = gl.createVertexArray()
    const buf = gl.createBuffer()
    let xy = new Float32Array(0)
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    const loc = gl.getAttribLocation(p, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    return {
      render(f, params) {
        copy(gl, f.input)
        const faces = f.face?.faces ?? []
        const n = faces.reduce((a, pts) => a + pts.length, 0)
        if (!n) return
        if (xy.length < n * 2) xy = new Float32Array(n * 2)
        let i = 0
        for (const pts of faces) for (const pt of pts) { xy[i++] = pt.x; xy[i++] = pt.y }

        gl.useProgram(p)
        gl.uniform1f(u.uSize, Number(params.size ?? 3) * (f.height / 720))
        gl.uniform3fv(u.uColor, hex(String(params.color ?? '#3BE8FF')))
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.bindVertexArray(vao)
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, xy.subarray(0, n * 2), gl.DYNAMIC_DRAW)
        gl.drawArrays(gl.POINTS, 0, n)
        gl.bindVertexArray(null)
      },
      dispose() {
        gl.deleteProgram(p)
        gl.deleteBuffer(buf)
        gl.deleteVertexArray(vao)
      }
    }
  }
}
export default faceDots
