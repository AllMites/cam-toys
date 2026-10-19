import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'
import { hex } from '../face/_util'

const FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform vec3 uA, uB; uniform float uContrast;
void main() {
  float l = dot(texture(uInput, uv).rgb, vec3(0.299, 0.587, 0.114));
  l = clamp((l - 0.5) * uContrast + 0.5, 0.0, 1.0);
  o = vec4(mix(uA, uB, l), 1.0);
}`

const def: FilterDef = {
  id: 'duotone', name: 'Duotone', category: 'color', icon: '🎨',
  cost: 'light', needs: [],
  hint: 'Two colours, poster vibes.',
  params: {
    shadow: { type: 'color', label: 'Shadows', default: '#1B1464' },
    light: { type: 'color', label: 'Highlights', default: '#FF6B9D' },
    contrast: { type: 'range', label: 'Contrast', min: 0.5, max: 3, step: 0.05, default: 1.4 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    return {
      render(f, params) {
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform3fv(u.uA, hex(String(params.shadow ?? '#1B1464')))
        gl.uniform3fv(u.uB, hex(String(params.light ?? '#FF6B9D')))
        gl.uniform1f(u.uContrast, Number(params.contrast ?? 1.4))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default def
