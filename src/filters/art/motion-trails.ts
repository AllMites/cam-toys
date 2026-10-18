import type { FilterDef } from '@engine/types'
import { bindTexture, copy, deleteTarget, drawFullscreen, program, target, uniforms, type Target } from '@engine/gl'
import { HEADER, num } from './_util'

// accum = mix(input, prevAccum, decay), with a minimum step so 8-bit ghosts fully fade.
const FS = `
uniform sampler2D uPrev; uniform float uDecay;
void main() {
  vec3 inp = texture(uInput, uv).rgb;
  vec3 res = mix(inp, texture(uPrev, uv).rgb, uDecay);
  vec3 d = inp - res;
  res += sign(d) * min(abs(d), vec3(1.5 / 255.0));
  o = vec4(res, 1.0);
}`

const def: FilterDef = {
  id: 'motion-trails', name: 'Time Echo', category:'art', icon: '💫',
  cost: 'light', needs: [],
  hint: 'Wave your arms around!',
  params: { decay: { type: 'range', label: 'Trail length', min: 0.5, max: 0.97, step: 0.01, default: 0.85 } },
  create(gl) {
    const p = program(gl, HEADER + FS)
    const u = uniforms(gl, p)
    let ts: [Target, Target] | null = null
    let cur = 0
    let fresh = true
    const free = () => {
      if (ts) { deleteTarget(gl, ts[0]); deleteTarget(gl, ts[1]) }
      ts = null
    }
    return {
      render(f, params) {
        if (!ts || ts[0].width !== f.width || ts[0].height !== f.height) {
          free()
          ts = [target(gl, f.width, f.height), target(gl, f.width, f.height)]
          fresh = true
        }
        const dst = ts[cur], prev = ts[1 - cur]
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
        gl.viewport(0, 0, f.width, f.height)
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        bindTexture(gl, 1, prev.tex, u.uPrev)
        gl.uniform1f(u.uDecay, fresh ? 0 : Math.min(0.99, Math.max(0, num(params.decay, 0.85))))
        drawFullscreen(gl)
        fresh = false

        gl.bindFramebuffer(gl.FRAMEBUFFER, f.output)
        gl.viewport(0, 0, f.width, f.height)
        copy(gl, dst.tex)
        cur = 1 - cur
      },
      dispose() {
        free()
        gl.deleteProgram(p)
      }
    }
  }
}
export default def
