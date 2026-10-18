import type { FilterDef } from '@engine/types'
import { bindTexture, copy, deleteTarget, drawFullscreen, program, uniforms, type Target } from '@engine/gl'
import { hex, sized } from './_util'

const MAX_GHOSTS = 6

// Snapshot: person colour with alpha = soft mask (half res).
const SNAP_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform sampler2D uMask;
void main() { o = vec4(texture(uInput, uv).rgb, smoothstep(0.3, 0.7, texture(uMask, uv).r)); }`

// One ghost, alpha-blended over the output, hidden wherever the live person is.
const GHOST_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uGhost; uniform sampler2D uMask;
uniform vec3 uTint; uniform float uOpacity;
void main() {
  vec4 g = texture(uGhost, uv);
  float live = smoothstep(0.3, 0.7, texture(uMask, uv).r);
  float l = dot(g.rgb, vec3(0.299, 0.587, 0.114));
  vec3 c = mix(g.rgb, uTint * (0.35 + 0.9 * l), 0.65) + uTint * 0.12;
  o = vec4(c, g.a * uOpacity * (1.0 - live));
}`

const def: FilterDef = {
  id: 'ghost-trails', name: 'Ghost Trails', category: 'body', icon: '👻',
  cost: 'heavy', needs: ['segment'],
  hint: 'Move side to side and leave ghost clones behind!',
  params: {
    ghosts: { type: 'range', label: 'Trail length', min: 1, max: MAX_GHOSTS, step: 1, default: 4 },
    spacing: { type: 'range', label: 'Gap', min: 0.04, max: 0.4, step: 0.01, default: 0.12 },
    tint: { type: 'color', label: 'Tint', default: '#8B5CF6' }
  },
  create(gl) {
    const pSnap = program(gl, SNAP_FS), uSnap = uniforms(gl, pSnap)
    const pGhost = program(gl, GHOST_FS), uGhost = uniforms(gl, pGhost)
    const ring: (Target | null)[] = new Array(MAX_GHOSTS).fill(null)
    let head = 0, count = 0, last = -1e9, rw = 0, rh = 0

    return {
      render(f, params) {
        if (!f.mask) { copy(gl, f.input); return }
        const w = Math.max(1, f.width >> 1), h = Math.max(1, f.height >> 1)
        if (w !== rw || h !== rh) {
          for (let i = 0; i < MAX_GHOSTS; i++) ring[i] = sized(gl, ring[i], w, h)
          rw = w; rh = h; head = 0; count = 0; last = -1e9
        }
        const n = Math.max(1, Math.min(MAX_GHOSTS, Math.round(Number(params.ghosts ?? 4))))
        const spacing = Number(params.spacing ?? 0.12)

        // time went backwards (camera restart) -> reset
        if (f.time < last) { count = 0; last = -1e9 }
        if (f.time - last >= spacing) {
          last = f.time
          const t = ring[head]!
          gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
          gl.viewport(0, 0, w, h)
          gl.useProgram(pSnap)
          bindTexture(gl, 0, f.input, uSnap.uInput)
          bindTexture(gl, 1, f.mask, uSnap.uMask)
          drawFullscreen(gl)
          head = (head + 1) % MAX_GHOSTS
          count = Math.min(count + 1, MAX_GHOSTS)
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, f.output)
        gl.viewport(0, 0, f.width, f.height)
        copy(gl, f.input)

        const shown = Math.min(n, count)
        if (!shown) return
        gl.useProgram(pGhost)
        gl.uniform3fv(uGhost.uTint, hex(String(params.tint ?? '#8B5CF6')))
        bindTexture(gl, 1, f.mask, uGhost.uMask)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        // oldest first so newer ghosts sit on top
        for (let age = shown; age >= 1; age--) {
          const t = ring[(head - age + MAX_GHOSTS * 2) % MAX_GHOSTS]!
          bindTexture(gl, 0, t.tex, uGhost.uGhost)
          gl.uniform1f(uGhost.uOpacity, 0.8 * (1 - (age - 1) / (n + 0.5)))
          drawFullscreen(gl)
        }
        gl.disable(gl.BLEND)
      },
      dispose() {
        gl.deleteProgram(pSnap); gl.deleteProgram(pGhost)
        for (const t of ring) if (t) deleteTarget(gl, t)
      }
    }
  }
}
export default def
