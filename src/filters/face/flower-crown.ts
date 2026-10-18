import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { faceGeo, makeSticker, svgTex } from './_util'
import crownSvg from './assets/flower-crown.svg?raw'

const flowerCrown: FilterDef = {
  id: 'flower-crown', name: 'Flower Crown', category: 'face', icon: '🌸',
  cost: 'medium', needs: ['face'],
  hint: 'A pretty ring of flowers for your hair.',
  params: {
    size: { type: 'range', label: 'Size', min: 0.7, max: 1.4, step: 0.01, default: 1 },
    height: { type: 'range', label: 'Height', min: -0.3, max: 0.3, step: 0.01, default: 0 }
  },
  create(gl) {
    const st = makeSticker(gl)
    const crown = svgTex(gl, crownSvg, 1024, 400)
    return {
      render(f, params) {
        copy(gl, f.input)
        const g = faceGeo(f)
        const t = crown.get()
        if (!g || !t) return
        const k = Number(params.size ?? 1)
        // Art: centre flower at y=110/400, side flowers lower (arch), so they land on the temples.
        const [x, y] = g.at(g.p(10), 0, 0.04 * k - Number(params.height ?? 0))
        st.draw(f, t, x, y, g.W * 1.35 * k, g.W * 1.35 * k * (400 / 1024), g.roll)
      },
      dispose() { st.dispose(); crown.dispose() }
    }
  }
}
export default flowerCrown
