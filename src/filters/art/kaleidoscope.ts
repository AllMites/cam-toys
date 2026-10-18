import { num, shaderFilter } from './_util'

const FS = `
uniform float uSeg; uniform float uSpin;
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x + 1e-5) + uTime * uSpin;
  float seg = 6.2831853 / uSeg;
  a = mod(a, seg);
  a = min(a, seg - a) - uTime * uSpin * 0.5;
  vec2 q = vec2(cos(a), sin(a)) * r * 0.9;
  q.x /= aspect;
  vec2 s = q + 0.5;
  s = 1.0 - abs(1.0 - mod(s, 2.0)); // mirrored repeat
  o = vec4(texture(uInput, s).rgb, 1.0);
}`

export default shaderFilter({
  id: 'kaleidoscope', name: 'Kaleidoscope', category:'art', icon: '🔮',
  cost: 'light', needs: [],
  hint: 'Lean in close and wiggle.',
  params: {
    segments: { type: 'range', label: 'Segments', min: 3, max: 16, step: 1, default: 8 },
    spin: { type: 'range', label: 'Spin', min: 0, max: 1, step: 0.01, default: 0.2 }
  }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uSeg, Math.max(2, Math.round(num(params.segments, 8))))
  gl.uniform1f(u.uSpin, num(params.spin, 0.2))
})
