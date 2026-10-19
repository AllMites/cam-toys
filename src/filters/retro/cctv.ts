import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'
import { canvasTex, makeSticker } from '../face/_util'

const FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform float uTime, uRes;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 c = uv - 0.5;
  vec2 q = 0.5 + c * (1.0 - 0.08 * dot(c, c)); // slight fisheye
  float l = dot(texture(uInput, q).rgb, vec3(0.299, 0.587, 0.114));
  l = l * 1.15 - 0.05;
  l *= 0.88 + 0.12 * sin(uv.y * uRes * 3.14159);
  l += (h(uv * uRes + uTime) - 0.5) * 0.12;
  l *= 1.0 - 0.9 * dot(c, c);
  o = vec4(vec3(l) * vec3(0.85, 1.0, 0.88), 1.0);
}`

const def: FilterDef = {
  id: 'cctv', name: 'CCTV', category: 'retro', icon: '📹',
  cost: 'light', needs: [],
  hint: 'You are being watched. Grainy security-cam look.',
  params: { rec: { type: 'toggle', label: 'REC badge', default: true } },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    const st = makeSticker(gl)
    const rec = canvasTex(gl, 512, 128, (ctx) => {
      ctx.fillStyle = '#ff2020'
      ctx.beginPath(); ctx.arc(56, 64, 30, 0, Math.PI * 2); ctx.fill()
      ctx.font = 'bold 72px Consolas, "Courier New", monospace'
      ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
      ctx.fillText('REC  CAM 01', 104, 68)
    })
    return {
      render(f, params) {
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uTime, f.time % 100)
        gl.uniform1f(u.uRes, f.height / 2)
        drawFullscreen(gl)
        if (params.rec !== false && Math.floor(f.time * 1.5) % 2 === 0) {
          const w = f.width * 0.28
          st.draw(f, rec, w / 2 + f.width * 0.03, f.height * 0.06 + w / 8, w, w / 4, 0, 0.9)
        }
      },
      dispose() { gl.deleteProgram(p); st.dispose(); gl.deleteTexture(rec) }
    }
  }
}
export default def
