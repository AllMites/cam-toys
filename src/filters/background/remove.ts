import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { hex } from './_util'

const FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform sampler2D uMask;
uniform vec3 uColor; uniform float uSoft;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  float m = smoothstep(0.5 - uSoft, 0.5 + uSoft, texture(uMask, uv).r);
  o = vec4(mix(uColor, c, m), 1.0);
}`

const def: FilterDef = {
  id: 'remove', name: 'Solid Background', category: 'background', icon: '🟩',
  cost: 'medium', needs: ['segment'],
  hint: 'Swap your room for one flat colour (green = chroma key).',
  params: {
    color: { type: 'color', label: 'Colour', default: '#00FF00' },
    soft: { type: 'range', label: 'Edge softness', min: 0.02, max: 0.45, step: 0.01, default: 0.2 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    return {
      render(f, params) {
        if (!f.mask) { copy(gl, f.input); return }
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        bindTexture(gl, 1, f.mask, u.uMask)
        gl.uniform3fv(u.uColor, hex(String(params.color ?? '#00FF00')))
        gl.uniform1f(u.uSoft, Number(params.soft ?? 0.2))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default def
