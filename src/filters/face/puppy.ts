import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { approach, blend, faceGeo, makeSticker, svgTex } from './_util'
import earSvg from './assets/puppy-ear.svg?raw'
import noseSvg from './assets/puppy-nose.svg?raw'
import tongueSvg from './assets/puppy-tongue.svg?raw'

const puppy: FilterDef = {
  id: 'puppy', name: 'Puppy', category: 'face', icon: '🐶',
  cost: 'medium', needs: ['face'],
  hint: 'Open your mouth to stick your tongue out!',
  params: {
    tongue: { type: 'toggle', label: 'Tongue', default: true },
    size: { type: 'range', label: 'Ear size', min: 0.6, max: 1.5, step: 0.01, default: 1 }
  },
  create(gl) {
    const st = makeSticker(gl)
    const ear = svgTex(gl, earSvg, 300, 540)
    const nose = svgTex(gl, noseSvg, 400, 300)
    const tongue = svgTex(gl, tongueSvg, 260, 360)
    let t = 0
    return {
      render(f, params) {
        copy(gl, f.input)
        const g = faceGeo(f)
        if (!g) { t = 0; return }
        const W = g.W
        const k = Number(params.size ?? 1)

        const e = ear.get()
        if (e) {
          const top = g.p(10)
          for (const side of [-1, 1]) {
            const base = g.at(top, side * 0.42, 0.02)
            const a = g.roll - side * (0.32 + 0.05 * Math.sin(f.time * 2.2 + side))
            const w = W * 0.38 * k, h = W * 0.68 * k
            st.draw(f, e, base[0] - Math.sin(a) * h / 2, base[1] + Math.cos(a) * h / 2, -side * w, h, a)
          }
        }

        const open = blend(f, 'jawOpen')
        t = approach(t, params.tongue !== false && open > 0.3 ? 1 : 0, 9, f.dt)
        const tg = tongue.get()
        if (tg && t > 0.02) {
          // Ease-out with a little overshoot so it "plops" out.
          const s = 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.12
          const [ux, uy] = g.p(13), [lx, ly] = g.p(14)
          const base = [ux + (lx - ux) * 0.6, uy + (ly - uy) * 0.6]
          const L = W * 0.42 * s
          const a = g.roll + Math.sin(f.time * 6) * 0.07 * t
          st.draw(f, tg, base[0] - Math.sin(a) * L / 2, base[1] + Math.cos(a) * L / 2, W * 0.28, L, a)
        }

        const n = nose.get()
        if (n) {
          const [x, y] = g.at(g.p(4), 0, -0.02)
          st.draw(f, n, x, y, W * 0.32, W * 0.24, g.roll)
        }
      },
      dispose() { st.dispose(); ear.dispose(); nose.dispose(); tongue.dispose() }
    }
  }
}
export default puppy
