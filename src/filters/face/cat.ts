import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { drawFromBase, faceGeo, hex, makeSticker, svgTex } from './_util'
import earOuterSvg from './assets/cat-ear-outer.svg?raw'
import earInnerSvg from './assets/cat-ear-inner.svg?raw'
import noseSvg from './assets/cat-nose.svg?raw'
import whiskersSvg from './assets/cat-whiskers.svg?raw'

const cat: FilterDef = {
  id: 'cat', name: 'Kitty', category: 'face', icon: '🐱',
  cost: 'medium', needs: ['face'],
  hint: 'Meow! Pointy ears and whiskers.',
  params: {
    color: { type: 'color', label: 'Fur colour', default: '#E39B4F' },
    whiskers: { type: 'toggle', label: 'Whiskers', default: true }
  },
  create(gl) {
    const st = makeSticker(gl)
    const earO = svgTex(gl, earOuterSvg, 400, 480)
    const earI = svgTex(gl, earInnerSvg, 400, 480)
    const nose = svgTex(gl, noseSvg, 600, 300)
    const whisk = svgTex(gl, whiskersSvg, 600, 300)
    return {
      render(f, params) {
        copy(gl, f.input)
        const g = faceGeo(f)
        if (!g) return
        const W = g.W
        const tint = hex(String(params.color ?? '#E39B4F'))
        const eo = earO.get(), ei = earI.get()
        if (eo && ei) {
          const top = g.p(10)
          for (const side of [-1, 1]) {
            const base = g.at(top, side * 0.36, 0.02)
            const tilt = side * (0.3 + 0.03 * Math.sin(f.time * 3 + side * 2))
            drawFromBase(st, f, g, eo, base, W * 0.42, W * 0.5, tilt, 1, tint)
            drawFromBase(st, f, g, ei, base, W * 0.42, W * 0.5, tilt)
          }
        }
        // Nose art is drawn with its pink nose at (300, 110) of 600×300.
        const nw = W * 0.8, nh = nw * 0.5
        const [x, y] = g.at(g.p(4), 0, 0.05)
        const wk = whisk.get()
        if (wk && params.whiskers !== false) st.draw(f, wk, x, y, nw, nh, g.roll)
        const n = nose.get()
        if (n) st.draw(f, n, x, y, nw, nh, g.roll)
      },
      dispose() { st.dispose(); earO.dispose(); earI.dispose(); nose.dispose(); whisk.dispose() }
    }
  }
}
export default cat
