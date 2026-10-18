import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'

const FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform float uAmount;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  o = vec4(mix(c, 1.0 - c, uAmount), 1.0);
}`

const invert: FilterDef = {
  id: 'invert', name: 'Invert', category: 'color', icon: '🔄',
  cost: 'light', needs: [],
  hint: 'Flip every colour to its opposite.',
  params: { amount: { type: 'range', label: 'Amount', min: 0, max: 1, step: 0.01, default: 1 } },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    return {
      render(f, params) {
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAmount, Number(params.amount ?? 1))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default invert
