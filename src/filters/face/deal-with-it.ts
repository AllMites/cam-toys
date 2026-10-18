import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { blend, canvasTex, clamp, faceGeo, makeSticker, mid } from './_util'

// Classic 8-bit shades on a 26×7 grid: B = black, W = white glint.
const GRID = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBB',
  '..BBBWWBBBBBBBBBBBWWBBBB..',
  '..BBWWBBBB....BBBWWBBBBB..',
  '..BBBBBBBB....BBBBBBBBBB..',
  '...BBBBBB......BBBBBBBB...',
  '....BBBB........BBBBBB....'
]
const CELL = 16
const GW = GRID[0].length, GH = GRID.length

const bounce = (x: number): number => {
  const n = 7.5625, d = 2.75
  if (x < 1 / d) return n * x * x
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375
  return n * (x -= 2.625 / d) * x + 0.984375
}

const dealWithIt: FilterDef = {
  id: 'deal-with-it', name: 'Deal With It', category: 'face', icon: '😎',
  cost: 'medium', needs: ['face'],
  hint: 'Smile big and the shades drop in.',
  params: {
    always: { type: 'toggle', label: 'Always on', default: false },
    caption: { type: 'toggle', label: 'Caption', default: true }
  },
  create(gl) {
    const st = makeSticker(gl)
    const shades = canvasTex(gl, GW * CELL, GH * CELL, (ctx) => {
      GRID.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return
        ctx.fillStyle = ch === 'W' ? '#ffffff' : '#000000'
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }))
    }, true)
    const text = canvasTex(gl, 1024, 160, (ctx) => {
      ctx.font = 'bold 110px "Press Start 2P", Impact, "Arial Black", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 16
      ctx.strokeStyle = '#000'
      ctx.strokeText('DEAL WITH IT', 512, 84)
      ctx.fillStyle = '#fff'
      ctx.fillText('DEAL WITH IT', 512, 84)
    })
    let on = false, q = 0
    return {
      render(f, params) {
        copy(gl, f.input)
        const g = faceGeo(f)
        if (!g) { q = 0; on = false; return }
        const smile = blend(f, 'mouthSmileLeft', 'mouthSmileRight')
        on = params.always === true || (on ? smile > 0.35 : smile > 0.5)
        q = clamp(q + (on ? 1 : -1.6) * f.dt / 0.8, 0, 1)
        if (q <= 0) return

        const W = g.W
        const sw = W * 0.98, sh = sw * GH / GW
        const [tx, ty] = g.at(mid(g.p(33), g.p(263)), 0, 0.03)
        const e = on ? bounce(q) : q * q
        const y = ty - (1 - e) * (ty + sh * 1.2)
        st.draw(f, shades, tx, y, sw, sh, g.roll * e)

        if (params.caption !== false && on && q > 0.9) {
          const a = (q - 0.9) / 0.1
          const cw = f.width * 0.62
          st.draw(f, text, f.width / 2, f.height - cw * (160 / 1024) * 0.8, cw, cw * (160 / 1024), 0, a)
        }
      },
      dispose() { st.dispose(); gl.deleteTexture(shades); gl.deleteTexture(text) }
    }
  }
}
export default dealWithIt
