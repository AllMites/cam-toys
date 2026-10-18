import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { approach, face, mouth } from '../eyes/_util'

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform float uAspect, uTime, uS, uLen, uW, uSparkle;
uniform vec2 uO, uD;
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 c = texture(uInput, uv).rgb;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec2 q = p - uO;
  vec2 side = vec2(-uD.y, uD.x);
  float along = dot(q, uD);
  float across = dot(q, side);
  across += sin(along * 22.0 - uTime * 11.0) * 0.06 * along;
  float w = uW * 0.42 + max(along, 0.0) * 0.3;
  float x = across / w;
  float body = (1.0 - smoothstep(0.82, 1.0, abs(x)))
             * smoothstep(0.0, uW * 0.12, along)
             * (1.0 - smoothstep(uLen * 0.8, uLen, along));
  vec3 col = hue((x * 0.5 + 0.5) * 0.83);
  col = mix(col, vec3(1.0), 0.12) + vec3(0.3) * pow(max(1.0 - abs(x - 0.3), 0.0), 10.0);
  // sparkles carried along the stream
  vec2 g = vec2(along - uTime * 0.7, across) * 55.0;
  float sp = step(0.975, hash(floor(g))) * (1.0 - smoothstep(0.1, 0.45, length(fract(g) - 0.5)));
  float a = body * uS;
  c = mix(c, col, a * 0.92) + vec3(sp * a * uSparkle);
  o = vec4(c, 1.0);
}`

const rainbowPuke: FilterDef = {
  id: 'expr-rainbow-puke', name: 'Rainbow Puke', category: 'face', icon: '🌈',
  cost: 'medium', needs: ['face'],
  hint: 'Open your mouth!',
  params: {
    size: { type: 'range', label: 'Size', min: 0.5, max: 2, step: 0.05, default: 1 },
    sparkle: { type: 'toggle', label: 'Sparkles', default: true }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    let s = 0, length = 0
    return {
      render(f, params) {
        const fc = face(f)
        const jaw = fc?.bs.jawOpen ?? 0
        const on = jaw > 0.3
        s = approach(s, on ? 1 : 0, f.dt, on ? 10 : 5)
        length = on ? Math.min(1.6, length + f.dt * 3) : (s < 0.03 ? 0 : length)
        if (!fc || s < 0.01) { copy(gl, f.input); return }
        const a = f.width / f.height
        const m = mouth(fc.pts, a)
        const size = Number(params.size ?? 1)
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAspect, a)
        gl.uniform1f(u.uTime, f.time % 600)
        gl.uniform1f(u.uS, s)
        gl.uniform1f(u.uLen, Math.max(0.02, length * size))
        gl.uniform1f(u.uW, m.w * size)
        gl.uniform1f(u.uSparkle, Boolean(params.sparkle ?? true) ? 1 : 0)
        gl.uniform2f(u.uO, m.c[0], m.c[1])
        gl.uniform2f(u.uD, m.dir[0], m.dir[1])
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default rainbowPuke
