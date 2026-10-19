import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { canvasTex, clamp, drawFromBase, faceGeo, makeSticker, mid } from './_util'

// "OPSEC Level: DEMON" meme: hacker mask, censor bar over the eyes, level meter caption.
const MW = 512, MH = 640

function drawMask(ctx: OffscreenCanvasRenderingContext2D): void {
  // face plate
  const g = ctx.createRadialGradient(256, 260, 40, 256, 300, 340)
  g.addColorStop(0, '#fbf8f0'); g.addColorStop(1, '#d9d2c2')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(256, 10)
  ctx.bezierCurveTo(470, 10, 500, 250, 470, 380)
  ctx.bezierCurveTo(440, 520, 340, 630, 256, 634)
  ctx.bezierCurveTo(172, 630, 72, 520, 42, 380)
  ctx.bezierCurveTo(12, 250, 42, 10, 256, 10)
  ctx.fill()
  ctx.lineWidth = 6; ctx.strokeStyle = '#8a8070'; ctx.stroke()
  // rosy cheeks
  for (const x of [140, 372]) {
    const c = ctx.createRadialGradient(x, 380, 0, x, 380, 70)
    c.addColorStop(0, 'rgba(225,110,110,0.7)'); c.addColorStop(1, 'rgba(225,110,110,0)')
    ctx.fillStyle = c; ctx.fillRect(x - 70, 310, 140, 140)
  }
  ctx.strokeStyle = '#111'; ctx.fillStyle = '#111'; ctx.lineCap = 'round'
  // arched brows
  ctx.lineWidth = 12
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(256 + s * 30, 200); ctx.quadraticCurveTo(256 + s * 110, 150, 256 + s * 190, 215); ctx.stroke()
  }
  // nose line
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.moveTo(250, 250); ctx.quadraticCurveTo(232, 360, 262, 380); ctx.stroke()
  // smirk
  ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(170, 470); ctx.quadraticCurveTo(256, 520, 342, 470); ctx.stroke()
  // curled mustache
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(256, 430)
    ctx.bezierCurveTo(256 + s * 60, 405, 256 + s * 130, 420, 256 + s * 150, 380)
    ctx.bezierCurveTo(256 + s * 165, 350, 256 + s * 190, 360, 256 + s * 185, 385)
    ctx.bezierCurveTo(256 + s * 170, 450, 256 + s * 70, 455, 256, 445)
    ctx.fill()
  }
  // goatee
  ctx.beginPath(); ctx.moveTo(240, 520); ctx.lineTo(272, 520); ctx.lineTo(256, 610); ctx.closePath(); ctx.fill()
}

const LEVELS = ['NONE', 'LOW', 'MID', 'HIGH', 'DEMON']

const opsecDemon: FilterDef = {
  id: 'opsec-demon', name: 'OPSEC Demon', category: 'face', icon: '😈',
  cost: 'medium', needs: ['face'],
  hint: 'Mask on, eyes redacted. The level meter ends where it always ends.',
  params: {
    bar: { type: 'toggle', label: 'Eye censor bar', default: true },
    horns: { type: 'toggle', label: 'Horns', default: true },
    caption: { type: 'toggle', label: 'Caption', default: true }
  },
  create(gl) {
    const st = makeSticker(gl)
    const mask = canvasTex(gl, MW, MH, drawMask)
    const bar = canvasTex(gl, 4, 4, (ctx) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 4, 4) })
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
        copy(gl, f.input)
        const g = faceGeo(f)
        t = g ? t + f.dt : 0
        if (!g) return
        const grow = clamp(t / 0.6, 0, 1)

        if (params.horns !== false) {
          const hw = g.W * 0.22, hh = hw * 2 * grow
          if (hh > 1) {
            drawFromBase(st, f, g, horn, g.at(g.p(103), 0, -0.05), -hw, hh, -0.35)
            drawFromBase(st, f, g, horn, g.at(g.p(332), 0, -0.05), hw, hh, 0.35)
          }
        }
        // mask centred between forehead and chin, a touch larger than the face
        const [cx, cy] = mid(g.p(10), g.p(152))
        const mw = g.W * 1.18
        st.draw(f, mask, cx, cy, mw, mw * MH / MW, g.roll)
        if (params.bar !== false) {
          const [ex, ey] = g.at(mid(g.p(33), g.p(263)), 0, 0.01)
          st.draw(f, bar, ex, ey, g.W * 1.35, g.W * 0.24, g.roll)
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
        st.dispose(); gl.deleteTexture(mask); gl.deleteTexture(bar); gl.deleteTexture(horn)
        caps.forEach((c) => gl.deleteTexture(c))
      }
    }
  }
}
export default opsecDemon
