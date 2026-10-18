import type { FilterDef, Pt } from '@engine/types'
import { bindTexture, copy, deleteTarget, program, target, textureFromCanvas, uniforms, type Target } from '@engine/gl'
import { GlowLines, additive, handPx, resetBlend } from './_util'

// Textured, rotated point sprites from a 2-cell atlas (0 = heart, 1 = star).
const SPR_VS = `#version 300 es
in vec2 aPos; in float aSize; in float aRot; in float aCell; in float aAlpha;
out float vRot; out float vCell; out float vAlpha;
void main() {
  vRot = aRot; vCell = aCell; vAlpha = aAlpha;
  gl_PointSize = aSize;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`
const SPR_FS = `#version 300 es
precision mediump float;
in float vRot; in float vCell; in float vAlpha; out vec4 o;
uniform sampler2D uAtlas;
void main() {
  // gl_PointCoord.y = 0 is the image-bottom side in engine FBOs, so flip to keep art upright.
  vec2 p = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y) - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 1.2 + 0.5;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
  vec4 t = texture(uAtlas, vec2((vCell + p.x) * 0.5, p.y));
  o = vec4(t.rgb, t.a * vAlpha);
}`

const CELL = 128
const N = 240 // sprite pool
const PS = 11 // x y vx vy age life size rot vrot kind seed
const VS = 6 // pos2 size rot cell alpha
const HEART = 0, STAR = 1

const BOLT_TIPS = [[4, 2], [8, 5], [20, 17]] as const // ILoveYou raised fingers: tip, base
const BOLT_PTS = 9
const BOLTS_PER_SIDE = BOLT_TIPS.length * 2 // main + branch per finger

function drawAtlas(ctx: OffscreenCanvasRenderingContext2D): void {
  // heart
  ctx.save()
  ctx.translate(CELL / 2, CELL / 2 + 4)
  ctx.shadowColor = 'rgba(255,60,120,0.9)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.moveTo(0, 38)
  ctx.bezierCurveTo(-58, 2, -40, -50, 0, -20)
  ctx.bezierCurveTo(40, -50, 58, 2, 0, 38)
  const hg = ctx.createRadialGradient(-12, -16, 4, 0, 0, 56)
  hg.addColorStop(0, '#ffb3d1')
  hg.addColorStop(0.45, '#ff4f8b')
  hg.addColorStop(1, '#e0164f')
  ctx.fillStyle = hg
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath()
  ctx.ellipse(-20, -16, 9, 5, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // star
  ctx.save()
  ctx.translate(CELL * 1.5, CELL / 2 + 3)
  ctx.shadowColor = 'rgba(255,200,40,0.9)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 21 : 50, a = -Math.PI / 2 + (i * Math.PI) / 5
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  const sg = ctx.createRadialGradient(-8, -10, 3, 0, 0, 52)
  sg.addColorStop(0, '#fffbe0')
  sg.addColorStop(0.5, '#ffd84a')
  sg.addColorStop(1, '#ffa000')
  ctx.fillStyle = sg
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4
  ctx.strokeStyle = '#ff9100'
  ctx.stroke()
  ctx.restore()
}

const gestureFx: FilterDef = {
  id: 'gesture-fx', name: 'Gesture FX', category: 'hands', icon: '✌️',
  cost: 'medium', needs: ['hands', 'gestures'],
  hint: '✌️ hearts, 👍 stars, 🤘 lightning, ✋ hold palm up to freeze!',
  params: {
    amount: { type: 'range', label: 'Amount', min: 0.3, max: 2, step: 0.1, default: 1 },
    size: { type: 'range', label: 'Size', min: 0.5, max: 2, step: 0.1, default: 1 },
    freeze: { type: 'toggle', label: '✋ freezes the picture', default: true }
  },
  create(gl) {
    const sp = program(gl, SPR_FS, SPR_VS)
    const su = uniforms(gl, sp)
    const atlas = textureFromCanvas(gl, CELL * 2, CELL, drawAtlas)
    const pool = new Float32Array(N * PS)
    const verts = new Float32Array(N * VS)
    const vao = gl.createVertexArray()
    const buf = gl.createBuffer()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW)
    const attr = (name: string, size: number, off: number): void => {
      const loc = gl.getAttribLocation(sp, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, VS * 4, off * 4)
    }
    attr('aPos', 2, 0); attr('aSize', 1, 2); attr('aRot', 1, 3); attr('aCell', 1, 4); attr('aAlpha', 1, 5)
    gl.bindVertexArray(null)
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null
    const maxPt = range ? range[1] : 64

    const lines = new GlowLines(gl, 2 * BOLTS_PER_SIDE * (BOLT_PTS - 1))
    // bolts in a local frame per finger: u along the finger (0..1 of bolt length), v sideways
    const bolts = new Float32Array(2 * BOLTS_PER_SIDE * BOLT_PTS * 2)
    const boltAlpha = new Float32Array(2 * BOLTS_PER_SIDE)
    const boltTimer = [0, 0]
    const heartAcc = [0, 0], starAcc = [0, 0]
    let cursor = 0, lastW = 0, lastH = 0
    let frozen: Target | null = null
    let isFrozen = false, palmT = 0, noPalmT = 0

    const spawn = (kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, vrot: number): void => {
      for (let tries = 0; tries < N; tries++) {
        const o = cursor * PS
        cursor = (cursor + 1) % N
        if (pool[o + 4] < pool[o + 5]) continue
        pool[o] = x; pool[o + 1] = y; pool[o + 2] = vx; pool[o + 3] = vy; pool[o + 4] = 0; pool[o + 5] = life
        pool[o + 6] = size; pool[o + 7] = (Math.random() - 0.5) * 0.6; pool[o + 8] = vrot; pool[o + 9] = kind
        pool[o + 10] = Math.random()
        return
      }
    }

    const regenBolts = (side: number): void => {
      for (let b = 0; b < BOLTS_PER_SIDE; b++) {
        const o = (side * BOLTS_PER_SIDE + b) * BOLT_PTS * 2
        boltAlpha[side * BOLTS_PER_SIDE + b] = 0.55 + Math.random() * 0.45
        if (b % 2 === 0) { // main bolt
          for (let j = 0; j < BOLT_PTS; j++) {
            bolts[o + j * 2] = j / (BOLT_PTS - 1)
            bolts[o + j * 2 + 1] = j ? (Math.random() - 0.5) * 0.22 : 0
          }
        } else { // branch off a random point of the main bolt
          const m = o - BOLT_PTS * 2, k = 2 + Math.floor(Math.random() * 4)
          const su0 = bolts[m + k * 2], sv0 = bolts[m + k * 2 + 1]
          const ang = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5)
          const du = Math.cos(ang), dv = Math.sin(ang), len = 0.4
          for (let j = 0; j < BOLT_PTS; j++) {
            const t = (j / (BOLT_PTS - 1)) * len, off = j ? (Math.random() - 0.5) * 0.08 : 0
            bolts[o + j * 2] = su0 + du * t - dv * off
            bolts[o + j * 2 + 1] = sv0 + dv * t + du * off
          }
        }
      }
    }

    const drawBolts = (side: number, p: Pt[], w: number, h: number, hp: number, s: number): void => {
      for (let fi = 0; fi < BOLT_TIPS.length; fi++) {
        const [tip, base] = BOLT_TIPS[fi]
        const tx = p[tip].x * w, ty = p[tip].y * h
        let dx = tx - p[base].x * w, dy = ty - p[base].y * h
        const dl = Math.hypot(dx, dy) || 1
        dx /= dl; dy /= dl
        const len = hp * 2.2
        for (let bb = 0; bb < 2; bb++) {
          const b = fi * 2 + bb
          const o = (side * BOLTS_PER_SIDE + b) * BOLT_PTS * 2
          const a = boltAlpha[side * BOLTS_PER_SIDE + b]
          const hw = (bb ? 5 : 8) * s
          let px = 0, py = 0
          for (let j = 0; j < BOLT_PTS; j++) {
            const u = bolts[o + j * 2] * len, v = bolts[o + j * 2 + 1] * len
            const x = tx + dx * u - dy * v, y = ty + dy * u + dx * v
            if (j) lines.seg(px, py, x, y, hw, 0.45, 0.65, 1, a)
            px = x; py = y
          }
        }
      }
    }

    return {
      render(f, params) {
        const { width: w, height: h } = f
        if (w !== lastW || h !== lastH) {
          pool.fill(0); lastW = w; lastH = h
          if (frozen) deleteTarget(gl, frozen)
          frozen = target(gl, w, h)
          isFrozen = false
          gl.bindFramebuffer(gl.FRAMEBUFFER, f.output)
          gl.viewport(0, 0, w, h)
        }
        const dt = Math.min(Math.max(f.dt, 0), 0.1)
        const s = h / 720
        const amount = Number(params.amount ?? 1)
        const sizeK = Number(params.size ?? 1) * s
        const hands = f.hands?.hands ?? []
        const gestures = f.hands?.gestures ?? []

        // gestures -> spawns
        let palm = false
        const bolting = [false, false]
        const hp0: number[] = [0, 0]
        const seen = [false, false]
        for (let i = 0; i < hands.length && i < 2; i++) {
          const p = hands[i]
          if (p.length < 21) continue
          const side = f.hands?.handedness[i] === 'Right' ? 1 : 0
          if (seen[side]) continue
          seen[side] = true
          const g = gestures[i] ?? 'None'
          const hp = handPx(p, w, h)
          hp0[side] = hp
          if (g === 'Open_Palm') palm = true
          if (g === 'Victory') {
            heartAcc[side] += 5 * amount * dt
            while (heartAcc[side] >= 1) {
              heartAcc[side] -= 1
              const x = ((p[8].x + p[12].x) / 2) * w, y = ((p[8].y + p[12].y) / 2) * h - hp * 0.3
              spawn(HEART, x + (Math.random() - 0.5) * hp * 0.6, y, (Math.random() - 0.5) * 60 * s,
                -(90 + Math.random() * 80) * s, 2 + Math.random() * 0.8, (50 + Math.random() * 30) * sizeK, 0)
            }
          } else heartAcc[side] = 0.6 // first heart appears quickly
          if (g === 'Thumb_Up') {
            starAcc[side] += 9 * amount * dt
            while (starAcc[side] >= 1) {
              starAcc[side] -= 1
              const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6, v = (180 + Math.random() * 220) * s
              spawn(STAR, p[4].x * w, p[4].y * h, Math.cos(a) * v, Math.sin(a) * v,
                1.1 + Math.random() * 0.7, (34 + Math.random() * 26) * sizeK, (Math.random() - 0.5) * 8)
            }
          } else starAcc[side] = 0.8
          if (g === 'ILoveYou') {
            bolting[side] = true
            boltTimer[side] -= dt
            if (boltTimer[side] <= 0) { regenBolts(side); boltTimer[side] = 0.05 + Math.random() * 0.05 }
          } else boltTimer[side] = 0
        }

        // ✋ freeze with a little debounce (gesture labels flicker)
        const freezeOn = Boolean(params.freeze ?? true)
        if (freezeOn && palm) { palmT += dt; noPalmT = 0 } else { noPalmT += dt; palmT = 0 }
        if (!isFrozen && palmT > 0.2 && frozen) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, frozen.fbo)
          gl.viewport(0, 0, w, h)
          copy(gl, f.input)
          gl.bindFramebuffer(gl.FRAMEBUFFER, f.output)
          gl.viewport(0, 0, w, h)
          isFrozen = true
        } else if (isFrozen && (noPalmT > 0.3 || !freezeOn)) isFrozen = false

        copy(gl, isFrozen && frozen ? frozen.tex : f.input)

        // lightning
        lines.begin(w, h)
        for (let i = 0; i < hands.length && i < 2; i++) {
          const side = f.hands?.handedness[i] === 'Right' ? 1 : 0
          if (bolting[side] && hands[i].length >= 21) { drawBolts(side, hands[i], w, h, hp0[side], s * Number(params.size ?? 1)); bolting[side] = false }
        }
        if (lines.count) { additive(gl); lines.draw(0.35) }

        // sprites
        let n = 0
        const damp = Math.exp(-2.2 * dt)
        for (let i = 0; i < N; i++) {
          const o = i * PS
          if (pool[o + 4] >= pool[o + 5]) continue
          const age = (pool[o + 4] += dt), life = pool[o + 5]
          if (age >= life) continue
          const kind = pool[o + 9], seed = pool[o + 10]
          let size = pool[o + 6], rot: number
          if (kind === HEART) {
            pool[o] += (pool[o + 2] + Math.sin(age * 3 + seed * 6.28) * 40 * s) * dt
            pool[o + 1] += pool[o + 3] * dt
            rot = pool[o + 7] + Math.sin(age * 2.5 + seed * 6.28) * 0.25
            size *= Math.min(1, age * 6) * (1 + 0.06 * Math.sin(age * 9))
          } else {
            pool[o + 2] *= damp; pool[o + 3] = pool[o + 3] * damp + 200 * s * dt
            pool[o] += pool[o + 2] * dt
            pool[o + 1] += pool[o + 3] * dt
            rot = (pool[o + 7] += pool[o + 8] * dt)
            size *= Math.min(1, age * 8)
          }
          const t = age / life
          const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
          const v = n * VS
          verts[v] = (pool[o] / w) * 2 - 1; verts[v + 1] = (pool[o + 1] / h) * 2 - 1
          verts[v + 2] = Math.min(size, maxPt); verts[v + 3] = rot; verts[v + 4] = kind; verts[v + 5] = alpha
          n++
        }
        if (n) {
          gl.enable(gl.BLEND)
          gl.blendEquation(gl.FUNC_ADD)
          gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
          gl.useProgram(sp)
          bindTexture(gl, 0, atlas, su.uAtlas)
          gl.bindVertexArray(vao)
          gl.bindBuffer(gl.ARRAY_BUFFER, buf)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts, 0, n * VS)
          gl.drawArrays(gl.POINTS, 0, n)
          gl.bindVertexArray(null)
        }
        resetBlend(gl)
      },
      dispose() {
        gl.deleteProgram(sp)
        gl.deleteTexture(atlas)
        gl.deleteBuffer(buf)
        gl.deleteVertexArray(vao)
        lines.dispose()
        if (frozen) deleteTarget(gl, frozen)
        frozen = null
      }
    }
  }
}
export default gestureFx
