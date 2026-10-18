import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { drawFromBase, faceGeo, hex, makeSmoother, makeSticker, svgTex } from './_util'
import earOuterSvg from './assets/bear-ear-outer.svg?raw'
import earInnerSvg from './assets/bear-ear-inner.svg?raw'
import noseSvg from './assets/bear-nose.svg?raw'
import blushSvg from './assets/blush.svg?raw'

const bear: FilterDef = {
  id: 'bear', name: 'Bear', category: 'face', icon: '🐻',
  cost: 'medium', needs: ['face'],
  hint: 'Become a cuddly little bear!',
  params: {
    color: { type: 'color', label: 'Ear colour', default: '#9A6233' },
    blush: { type: 'range', label: 'Blush', min: 0, max: 1, step: 0.01, default: 0.7 },
    smooth: { type: 'range', label: 'Soft skin', min: 0, max: 1, step: 0.01, default: 0.5 }
  },
  create(gl) {
    const st = makeSticker(gl)
    const sm = makeSmoother(gl)
    const earO = svgTex(gl, earOuterSvg, 512, 512)
    const earI = svgTex(gl, earInnerSvg, 512, 512)
    const nose = svgTex(gl, noseSvg, 512, 420)
    const blush = svgTex(gl, blushSvg, 256, 256)
    return {
      render(f, params) {
        const g = faceGeo(f)
        const smooth = Number(params.smooth ?? 0.5)
        if (!g) { copy(gl, f.input); return }
        if (smooth > 0.01) sm.render(f, g, smooth, smooth * 0.5, 0.6)
        else copy(gl, f.input)

        const W = g.W
        const top = g.p(10)
        const tint = hex(String(params.color ?? '#9A6233'))
        const eo = earO.get(), ei = earI.get()
        if (eo && ei) {
          for (const side of [-1, 1]) {
            const base = g.at(top, side * 0.4, 0.05)
            const tilt = side * 0.28
            drawFromBase(st, f, g, eo, base, W * 0.5, W * 0.5, tilt, 1, tint)
            drawFromBase(st, f, g, ei, base, W * 0.5, W * 0.5, tilt)
          }
        }
        const bl = blush.get()
        const ba = Number(params.blush ?? 0.7)
        if (bl && ba > 0) {
          for (const i of [50, 280]) {
            const [x, y] = g.p(i)
            st.draw(f, bl, x, y, W * 0.26, W * 0.26, g.roll, ba)
          }
        }
        const n = nose.get()
        if (n) {
          const [x, y] = g.at(g.p(4), 0, -0.03)
          st.draw(f, n, x, y, W * 0.3, W * 0.3 * (420 / 512), g.roll)
        }
      },
      dispose() {
        st.dispose(); sm.dispose()
        earO.dispose(); earI.dispose(); nose.dispose(); blush.dispose()
      }
    }
  }
}
export default bear
