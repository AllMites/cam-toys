import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { DOT, FINGERTIPS, GlowLines, GlowPoints, HAND_CONNECTIONS, additive, hex, resetBlend } from './_util'

const handSkeleton: FilterDef = {
  id: 'hand-skeleton', name: 'Hand Skeleton', category: 'hands', icon: '🦴',
  cost: 'medium', needs: ['hands'],
  hint: 'Wave your hands to see their glowing bones!',
  params: {
    color: { type: 'color', label: 'Colour', default: '#3BE8FF' },
    thickness: { type: 'range', label: 'Thickness', min: 1, max: 10, step: 0.5, default: 4 },
    twoTone: { type: 'toggle', label: 'Different colour per hand', default: true }
  },
  create(gl) {
    const lines = new GlowLines(gl, HAND_CONNECTIONS.length * 2)
    const dots = new GlowPoints(gl, 21 * 2)
    return {
      render(f, params) {
        copy(gl, f.input)
        const hands = f.hands?.hands ?? []
        if (!hands.length) return
        const { width: w, height: h } = f
        const s = h / 720
        const thick = Number(params.thickness ?? 4) * s
        const base = hex(String(params.color ?? '#3BE8FF'))
        const two = Boolean(params.twoTone ?? true)
        lines.begin(w, h)
        dots.begin(w, h)
        for (let i = 0; i < hands.length && i < 2; i++) {
          const p = hands[i]
          if (p.length < 21) continue
          // Right hand gets the channel-rotated colour (cyan -> pink) so the two hands differ.
          const right = two && f.hands?.handedness[i] === 'Right'
          const r = right ? base[2] : base[0], g = right ? base[0] : base[1], b = right ? base[1] : base[2]
          for (const [a, c] of HAND_CONNECTIONS) {
            lines.seg(p[a].x * w, p[a].y * h, p[c].x * w, p[c].y * h, thick * 2.5, r, g, b, 0.9)
          }
          for (let j = 0; j < 21; j++) {
            const tip = (FINGERTIPS as readonly number[]).includes(j)
            dots.point(p[j].x * w, p[j].y * h, thick * (tip ? 6 : 4.5), r, g, b, 1)
          }
        }
        additive(gl)
        lines.draw(0.28)
        dots.draw(DOT)
        resetBlend(gl)
      },
      dispose() {
        lines.dispose()
        dots.dispose()
      }
    }
  }
}
export default handSkeleton
