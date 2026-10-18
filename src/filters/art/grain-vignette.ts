import { num, shaderFilter } from './_util'

const FS = `
uniform float uGrain; uniform float uVig;
void main() {
  vec3 c = texture(uInput, uv).rgb;
  float l = luma(c);
  float n = hash12(floor(uv * uRes) + fract(uTime * 13.7) * 1000.0) - 0.5;
  n += hash12(floor(uv * uRes * 0.5) + fract(uTime * 7.3) * 800.0) - 0.5; // clumpier grain
  c += n * uGrain * 0.18 * (1.0 - abs(l * 2.0 - 1.0) * 0.6);
  vec2 d = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= 1.0 - uVig * smoothstep(0.25, 1.05, length(d));
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

export default shaderFilter({
  id: 'grain-vignette', name: 'Film Look', category:'art', icon: '🎬',
  cost: 'light', needs: [],
  hint: 'Instant indie film vibes.',
  params: {
    grain: { type: 'range', label: 'Grain', min: 0, max: 1, step: 0.01, default: 0.4 },
    vignette: { type: 'range', label: 'Vignette', min: 0, max: 1, step: 0.01, default: 0.55 }
  }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uGrain, num(params.grain, 0.4))
  gl.uniform1f(u.uVig, num(params.vignette, 0.55))
})
