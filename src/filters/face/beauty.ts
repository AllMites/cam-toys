import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { faceGeo, makeSmoother } from './_util'

const beauty: FilterDef = {
  id: 'beauty', name: 'Beauty', category: 'face', icon: '✨',
  cost: 'medium', needs: ['face'],
  hint: 'Soft, glowy skin — like a good-lighting day.',
  params: {
    smooth: { type: 'range', label: 'Smooth', min: 0, max: 1, step: 0.01, default: 0.7 },
    bright: { type: 'range', label: 'Brighten', min: 0, max: 1, step: 0.01, default: 0.4 },
    warm: { type: 'range', label: 'Warmth', min: 0, max: 1, step: 0.01, default: 0.3 }
  },
  create(gl) {
    const sm = makeSmoother(gl)
    return {
      render(f, params) {
        const g = faceGeo(f)
        if (!g) { copy(gl, f.input); return }
        sm.render(f, g, Number(params.smooth ?? 0.7), Number(params.bright ?? 0.4), Number(params.warm ?? 0.3))
      },
      dispose: () => sm.dispose()
    }
  }
}
export default beauty
