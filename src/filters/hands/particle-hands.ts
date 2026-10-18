import type { FilterDef } from '@engine/types'
import { copy } from '@engine/gl'
import { FINGERTIPS, GlowPoints, SPARKLE, additive, handPx, hex, hsv, resetBlend, type RGB } from './_util'

const N = 1200 // particle pool size
const S = 8 // floats per particle: x y vx vy age life size seed

const particleHands: FilterDef = {
  id: 'particle-hands', name: 'Sparkle Hands', category: 'hands', icon: '✨',
  cost: 'medium', needs: ['hands'],
  hint: 'Wiggle your fingers to throw sparkles!',
  params: {
    color: { type: 'color', label: 'Colour', default: '#FFD15C' },
    rainbow: { type: 'toggle', label: 'Rainbow', default: false },
    amount: { type: 'range', label: 'Amount', min: 0.2, max: 2, step: 0.1, default: 1 }
  },
  create(gl) {
    const pts = new GlowPoints(gl, N)
    const pool = new Float32Array(N * S) // age >= life means dead (all zero = dead)
    const prev = new Float32Array(2 * 5 * 2)
    const prevHas = [false, false]
    const acc = new Float32Array(2 * 5)
    const rgb: RGB = [0, 0, 0]
    let cursor = 0, lastW = 0, lastH = 0

    const spawn = (x: number, y: number, vx: number, vy: number, life: number, size: number): void => {
      for (let tries = 0; tries < N; tries++) {
        const i = cursor
        cursor = (cursor + 1) % N
        const o = i * S
        if (pool[o + 4] < pool[o + 5]) continue
        pool[o] = x; pool[o + 1] = y; pool[o + 2] = vx; pool[o + 3] = vy
        pool[o + 4] = 0; pool[o + 5] = life; pool[o + 6] = size; pool[o + 7] = Math.random()
        return
      }
    }

    return {
      render(f, params) {
        const { width: w, height: h } = f
        if (w !== lastW || h !== lastH) { pool.fill(0); lastW = w; lastH = h }
        const dt = Math.min(Math.max(f.dt, 0), 0.1)
        const s = h / 720
        const rate = 45 * Number(params.amount ?? 1)
        const rainbow = Boolean(params.rainbow ?? false)
        const base = hex(String(params.color ?? '#FFD15C'))

        // emit from the 5 fingertips of each hand; faster fingers emit more
        const hands = f.hands?.hands ?? []
        const seen = [false, false]
        for (let i = 0; i < hands.length && i < 2; i++) {
          const p = hands[i]
          if (p.length < 21) continue
          const side = f.hands?.handedness[i] === 'Right' ? 1 : 0
          if (seen[side]) continue
          seen[side] = true
          const hp = handPx(p, w, h)
          for (let k = 0; k < 5; k++) {
            const t = p[FINGERTIPS[k]]
            const x = t.x * w, y = t.y * h
            const pi = (side * 5 + k) * 2
            let vx = 0, vy = 0
            if (prevHas[side] && dt > 0) { vx = (x - prev[pi]) / dt; vy = (y - prev[pi + 1]) / dt }
            prev[pi] = x; prev[pi + 1] = y
            const speed = Math.hypot(vx, vy)
            if (speed > hp * 30) { vx = vy = 0 } // tracking jump, not real motion
            const a = side * 5 + k
            acc[a] += rate * dt * (1 + Math.min(speed / (hp * 3), 3))
            while (acc[a] >= 1) {
              acc[a] -= 1
              const ang = Math.random() * Math.PI * 2
              const sp = hp * (0.2 + Math.random() * 0.6)
              spawn(
                x + (Math.random() - 0.5) * hp * 0.1, y + (Math.random() - 0.5) * hp * 0.1,
                vx * 0.3 + Math.cos(ang) * sp, vy * 0.3 + Math.sin(ang) * sp - hp * 0.3,
                0.6 + Math.random() * 0.9, (14 + Math.random() * 22) * s
              )
            }
          }
        }
        for (let k = 0; k < 2; k++) {
          prevHas[k] = seen[k]
          if (!seen[k]) acc.fill(0, k * 5, k * 5 + 5)
        }

        // simulate + pack
        const damp = Math.exp(-1.8 * dt)
        const grav = 160 * s
        pts.begin(w, h)
        for (let i = 0; i < N; i++) {
          const o = i * S
          if (pool[o + 4] >= pool[o + 5]) continue
          const age = (pool[o + 4] += dt)
          const life = pool[o + 5]
          if (age >= life) continue
          pool[o + 2] *= damp
          pool[o + 3] = pool[o + 3] * damp + grav * dt
          pool[o] += pool[o + 2] * dt
          pool[o + 1] += pool[o + 3] * dt
          const t = age / life, seed = pool[o + 7]
          const fadeA = (1 - t) * (1 - t) * (0.65 + 0.35 * Math.sin(age * 18 + seed * 40))
          let r: number, g: number, b: number
          if (rainbow) { hsv(seed + f.time * 0.3, 0.75, 1, rgb); r = rgb[0]; g = rgb[1]; b = rgb[2] }
          else { const m = seed * 0.45; r = base[0] + (1 - base[0]) * m; g = base[1] + (1 - base[1]) * m; b = base[2] + (1 - base[2]) * m }
          pts.point(pool[o], pool[o + 1], pool[o + 6] * (1 - 0.5 * t), r, g, b, fadeA)
        }

        copy(gl, f.input)
        if (!pts.count) return
        additive(gl)
        pts.draw(SPARKLE)
        resetBlend(gl)
      },
      dispose() {
        pts.dispose()
      }
    }
  }
}
export default particleHands
