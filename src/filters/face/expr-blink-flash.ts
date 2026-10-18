import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'
import { face } from '../eyes/_util'

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform float uK, uFlash, uGlitch, uSeed;
float h(float x) { return fract(sin(x * 91.345) * 47453.5453); }
void main() {
  vec2 u = uv;
  float g = uK * uGlitch;
  float row = floor(uv.y * 24.0);
  float r = h(row + uSeed);
  u.x = clamp(u.x + (h(row * 1.7 + uSeed * 3.1) - 0.5) * 0.14 * g * step(0.6, r), 0.0, 1.0);
  float s = 0.03 * g;
  vec3 c = vec3(texture(uInput, u + vec2(s, 0.0)).r, texture(uInput, u).g, texture(uInput, u - vec2(s, 0.0)).b);
  c += 0.25 * uK * uFlash;
  c = mix(c, vec3(1.0), uFlash * uK * uK);
  o = vec4(c, 1.0);
}`

const DURATION = 0.4

const blinkFlash: FilterDef = {
  id: 'expr-blink-flash', name: 'Blink Flash', category: 'face', icon: '📸',
  cost: 'medium', needs: ['face'],
  hint: 'Blink to fire the camera flash!',
  params: {
    flash: { type: 'range', label: 'Flash', min: 0, max: 1, step: 0.01, default: 0.9 },
    glitch: { type: 'toggle', label: 'Glitch', default: true }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    let age = 1e9, armed = true
    return {
      render(f, params) {
        const fc = face(f)
        if (fc) {
          const blink = Math.min(fc.bs.eyeBlinkLeft ?? 0, fc.bs.eyeBlinkRight ?? 0)
          if (armed && blink > 0.5) { armed = false; age = 0 }
          else if (blink < 0.3) armed = true
        }
        age += Math.max(0, f.dt)
        const k = Math.max(0, 1 - age / DURATION)
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uK, k)
        gl.uniform1f(u.uFlash, Number(params.flash ?? 0.9))
        gl.uniform1f(u.uGlitch, Boolean(params.glitch ?? true) ? 1 : 0)
        gl.uniform1f(u.uSeed, Math.floor((f.time * 30) % 997))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default blinkFlash
