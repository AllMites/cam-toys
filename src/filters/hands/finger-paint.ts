import type { FilterDef } from '@engine/types'
import { copy, deleteTarget, drawFullscreen, program, target, uniforms, type Target } from '@engine/gl'
import { DOT, GlowLines, GlowPoints, additive, handPx, hsv, resetBlend, type RGB } from './_util'

// Subtracted from the paint target every frame (REVERSE_SUBTRACT) = linear fade-out.
const FADE_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform float uAmt;
void main() { o = vec4(uAmt); }`

const COLORS: Record<string, RGB> = {
  'Neon Pink': [1, 0.2, 0.75], Cyan: [0.2, 0.9, 1], Lime: [0.55, 1, 0.2], Gold: [1, 0.78, 0.2], White: [1, 1, 1]
}

interface Pen { x: number; y: number; down: boolean; has: boolean }

const fingerPaint: FilterDef = {
  id: 'finger-paint', name: 'Finger Paint', category: 'hands', icon: '🖌️',
  cost: 'medium', needs: ['hands'],
  hint: 'Pinch thumb + index finger to draw neon, open them to lift the pen.',
  params: {
    color: { type: 'select', label: 'Colour', options: ['Rainbow', ...Object.keys(COLORS)], default: 'Rainbow' },
    size: { type: 'range', label: 'Brush size', min: 2, max: 20, step: 1, default: 7 },
    fade: { type: 'range', label: 'Fade speed', min: 0, max: 1, step: 0.05, default: 0.25 }
  },
  create(gl) {
    const fadeP = program(gl, FADE_FS)
    const fu = uniforms(gl, fadeP)
    const lines = new GlowLines(gl, 16)
    const cursors = new GlowPoints(gl, 2)
    const pens: Pen[] = [0, 1].map(() => ({ x: 0, y: 0, down: false, has: false }))
    const seen = [false, false]
    const rgb: RGB = [0, 0, 0]
    let paint: Target | null = null

    return {
      render(f, params) {
        const { width: w, height: h } = f
        if (!paint || paint.width !== w || paint.height !== h) {
          if (paint) deleteTarget(gl, paint)
          paint = target(gl, w, h)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT)
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, paint.fbo)
        gl.viewport(0, 0, w, h)

        // 1. fade old paint
        const fade = Number(params.fade ?? 0.25)
        if (fade > 0) {
          gl.enable(gl.BLEND)
          gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT) // dst - src
          gl.blendFunc(gl.ONE, gl.ONE)
          gl.useProgram(fadeP)
          gl.uniform1f(fu.uAmt, Math.max(1.2 / 255, fade * 0.6 * Math.min(f.dt, 0.1)))
          drawFullscreen(gl)
        }

        // 2. new strokes (pinch = pen down; pen sits between thumb and index tips)
        const s = h / 720
        const hw = Number(params.size ?? 7) * s * 1.6
        const colName = String(params.color ?? 'Rainbow')
        const fixed = COLORS[colName]
        const hands = f.hands?.hands ?? []
        lines.begin(w, h)
        cursors.begin(w, h)
        seen[0] = seen[1] = false
        for (let i = 0; i < hands.length && i < 2; i++) {
          const p = hands[i]
          if (p.length < 21) continue
          const side = f.hands?.handedness[i] === 'Right' ? 1 : 0
          if (seen[side]) continue
          seen[side] = true
          const pen = pens[side]
          const size = handPx(p, w, h)
          const pinchD = Math.hypot((p[4].x - p[8].x) * w, (p[4].y - p[8].y) * h) / size
          const pinch = pen.down ? pinchD < 0.5 : pinchD < 0.3 // hysteresis
          const tx = ((p[4].x + p[8].x) / 2) * w, ty = ((p[4].y + p[8].y) / 2) * h
          const sx = pen.has ? pen.x + (tx - pen.x) * 0.6 : tx
          const sy = pen.has ? pen.y + (ty - pen.y) * 0.6 : ty
          const c = fixed ?? hsv(f.time * 0.15 + side * 0.5, 0.85, 1, rgb)
          if (pinch && pen.down && pen.has && Math.hypot(sx - pen.x, sy - pen.y) < size * 4) {
            lines.seg(pen.x, pen.y, sx, sy, hw, c[0], c[1], c[2], 1)
          }
          cursors.point(sx, sy, hw * (pinch ? 2.4 : 1.6), c[0], c[1], c[2], pinch ? 1 : 0.45)
          pen.x = sx; pen.y = sy; pen.down = pinch; pen.has = true
        }
        for (let k = 0; k < 2; k++) if (!seen[k]) { pens[k].has = false; pens[k].down = false }
        if (lines.count) {
          gl.enable(gl.BLEND)
          gl.blendEquation(gl.MAX) // overlapping strokes don't blow out to white
          lines.draw(0.3)
        }

        // 3. composite: camera + additive paint + cursors
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.output)
        gl.viewport(0, 0, w, h)
        gl.disable(gl.BLEND)
        copy(gl, f.input)
        additive(gl)
        copy(gl, paint.tex)
        cursors.draw(DOT)
        resetBlend(gl)
      },
      dispose() {
        gl.deleteProgram(fadeP)
        lines.dispose()
        cursors.dispose()
        if (paint) deleteTarget(gl, paint)
        paint = null
      }
    }
  }
}
export default fingerPaint
