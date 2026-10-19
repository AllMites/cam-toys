import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'
import { canvasTex, clamp, drawFromBase, faceGeo, makeSticker, mid } from './_util'

// "OPSEC Level: DEMON" meme: identity fully censored, only glowing demon eyes show through.
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform vec2 uRes, uC, uR, uE0, uE1;
uniform float uRot, uBlock, uEyeR, uTime, uGlow;
void main() {
  vec2 px = uv * uRes;
  vec2 d = px - uC;
  float cs = cos(uRot), sn = sin(uRot);
  vec2 l = vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs) / uR;
  float m = 1.0 - smoothstep(0.92, 1.0, length(l));
  vec3 c = texture(uInput, uv).rgb;
  // blocky censor, darkened toward the shadow-realm
  vec2 q = (floor(px / uBlock) + 0.5) * uBlock / uRes;
  vec3 b = texture(uInput, q).rgb;
  b = mix(vec3(dot(b, vec3(0.3, 0.59, 0.11))), b, 0.3) * 0.45;
  vec3 col = mix(c, b, m);
  float flick = 0.85 + 0.15 * sin(uTime * 23.0);
  for (int i = 0; i < 2; i++) {
    float e = length(px - (i == 0 ? uE0 : uE1)) / uEyeR;
    col += vec3(1.0, 0.08, 0.02) * (exp(-e * e * 1.5) * 2.0 + exp(-e * 0.9) * 0.6) * uGlow * flick;
    col += vec3(1.0, 0.9, 0.6) * exp(-e * e * 8.0) * uGlow;
  }
  o = vec4(col, 1.0);
}`

const LEVELS = ['NONE', 'LOW', 'MID', 'HIGH', 'DEMON']

const opsecDemon: FilterDef = {
  id: 'opsec-demon', name: 'OPSEC Demon', category: 'face', icon: '😈',
  cost: 'medium', needs: ['face'],
  hint: 'Identity: classified. The level meter ends where it always ends.',
  params: {
    block: { type: 'range', label: 'Censor size', min: 6, max: 40, step: 1, default: 18 },
    horns: { type: 'toggle', label: 'Horns', default: true },
    caption: { type: 'toggle', label: 'Caption', default: true }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    const st = makeSticker(gl)
    const horn = canvasTex(gl, 128, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 256, 0, 0)
      g.addColorStop(0, '#3a0000'); g.addColorStop(0.6, '#b00000'); g.addColorStop(1, '#ff4020')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(8, 256)
      ctx.quadraticCurveTo(10, 90, 100, 4)
      ctx.quadraticCurveTo(60, 120, 120, 256)
      ctx.closePath()
      ctx.fill()
    })
    const label = (word: string, color: string): WebGLTexture => canvasTex(gl, 1024, 160, (ctx) => {
      ctx.font = 'bold 96px Impact, "Arial Black", sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
      ctx.lineWidth = 14; ctx.strokeStyle = '#000'
      ctx.strokeText(`OPSEC LEVEL: ${word}`, 512, 84)
      ctx.fillStyle = color
      ctx.fillText(`OPSEC LEVEL: ${word}`, 512, 84)
    })
    const caps = LEVELS.map((w, i) => label(w, i === LEVELS.length - 1 ? '#ff2a1a' : '#fff'))
    let t = 0
    return {
      render(f, params) {
        const g = faceGeo(f)
        t = g ? t + f.dt : 0
        const glow = clamp(t / 0.6, 0, 1)
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform2f(u.uRes, f.width, f.height)
        if (g) {
          const c = mid(g.p(10), g.p(152))
          gl.uniform2f(u.uC, c[0], c[1])
          gl.uniform2f(u.uR, g.W * 0.62, g.H * 0.66)
          gl.uniform1f(u.uRot, g.roll)
          const e0 = g.p(468), e1 = g.p(473) // iris centres
          gl.uniform2f(u.uE0, e0[0], e0[1])
          gl.uniform2f(u.uE1, e1[0], e1[1])
          gl.uniform1f(u.uEyeR, g.W * 0.05)
        } else {
          gl.uniform2f(u.uR, 0, 0) // no face: pass through
        }
        gl.uniform1f(u.uBlock, Math.max(2, Number(params.block ?? 18) * f.width / 1280))
        gl.uniform1f(u.uTime, f.time)
        gl.uniform1f(u.uGlow, g ? glow : 0)
        drawFullscreen(gl)
        if (!g) return

        if (params.horns !== false) {
          const hw = g.W * 0.22, hh = hw * 2 * glow
          if (hh > 1) {
            drawFromBase(st, f, g, horn, g.at(g.p(103), 0, -0.02), -hw, hh, -0.35)
            drawFromBase(st, f, g, horn, g.at(g.p(332), 0, -0.02), hw, hh, 0.35)
          }
        }
        if (params.caption !== false) {
          // ponytail: meter ticks up once per face-acquire, then locks on DEMON
          const i = Math.min(LEVELS.length - 1, Math.floor(t / 0.35))
          const demon = i === LEVELS.length - 1
          const shake = demon ? Math.sin(f.time * 60) * f.width * 0.003 : 0
          const cw = f.width * (demon ? 0.7 : 0.6)
          st.draw(f, caps[i], f.width / 2 + shake, f.height - cw * (160 / 1024) * 0.8, cw, cw * (160 / 1024), 0)
        }
      },
      dispose() {
        gl.deleteProgram(p); st.dispose(); gl.deleteTexture(horn)
        caps.forEach((c) => gl.deleteTexture(c))
      }
    }
  }
}
export default opsecDemon
