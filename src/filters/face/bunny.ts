import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { drawFromBase, faceGeo, hex, makeSticker, svgTex } from './_util'
import earOuterSvg from './assets/bunny-ear-outer.svg?raw'
import earInnerSvg from './assets/bunny-ear-inner.svg?raw'
import noseSvg from './assets/cat-nose.svg?raw'
import whiskersSvg from './assets/cat-whiskers.svg?raw'
import teethSvg from './assets/bunny-teeth.svg?raw'

const bunny: FilterDef = {
  id: 'bunny', name: 'Bunny', category: 'face', icon: '🐰',
  cost: 'medium', needs: ['face'],
  hint: 'Hop hop! Tall bunny ears and buck teeth.',
  params: {
    color: { type: 'color', label: 'Fur colour', default: '#F5EFEA' },
    teeth: { type: 'toggle', label: 'Buck teeth', default: true }
  },
  create(gl) {
    const st = makeSticker(gl)
    const earO = svgTex(gl, earOuterSvg, 260, 700)
    const earI = svgTex(gl, earInnerSvg, 260, 700)
    const nose = svgTex(gl, noseSvg, 600, 300)
    const whisk = svgTex(gl, whiskersSvg, 600, 300)
    const teeth = svgTex(gl, teethSvg, 200, 180)
    return {
      render(f, params) {
        copy(gl, f.input)
        const g = faceGeo(f)
        if (!g) return
        const W = g.W
        const tint = hex(String(params.color ?? '#F5EFEA'))
        const eo = earO.get(), ei = earI.get()
        if (eo && ei) {
          const top = g.p(10)
          for (const side of [-1, 1]) {
            const base = g.at(top, side * 0.2, -0.06)
            const tilt = side * (0.2 + 0.06 * Math.sin(f.time * 2.5 + side * 1.3))
            drawFromBase(st, f, g, eo, base, W * 0.3, W * 0.82, tilt, 1, tint)
            drawFromBase(st, f, g, ei, base, W * 0.3, W * 0.82, tilt)
          }
        }
        const tt = teeth.get()
        if (tt && params.teeth !== false) {
          const [x, y] = g.at(g.p(13), 0, 0.06)
          st.draw(f, tt, x, y, W * 0.16, W * 0.144, g.roll)
        }
        const nw = W * 0.6, nh = nw * 0.5
        const [x, y] = g.at(g.p(4), 0, 0.03)
        const wk = whisk.get()
        if (wk) st.draw(f, wk, x, y, nw, nh, g.roll, 0.9)
        const n = nose.get()
        if (n) st.draw(f, n, x, y, nw, nh, g.roll)
      },
      dispose() { st.dispose(); earO.dispose(); earI.dispose(); nose.dispose(); whisk.dispose(); teeth.dispose() }
    }
  }
}
export default bunny
