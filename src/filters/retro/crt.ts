import { num, shaderFilter } from './_util'

const FS = `
uniform float uCurve; uniform float uScan;
void main() {
  vec2 q = uv * 2.0 - 1.0;
  q.x *= 1.0 + q.y * q.y * uCurve;
  q.y *= 1.0 + q.x * q.x * uCurve * 1.3;
  vec2 p = q * 0.5 + 0.5;
  vec2 e = smoothstep(vec2(0.0), vec2(0.006), p) * smoothstep(vec2(0.0), vec2(0.006), 1.0 - p);
  float inside = e.x * e.y;

  float dx = 1.2 / uRes.x;
  vec3 c = vec3(texture(uInput, p + vec2(dx, 0.0)).r, texture(uInput, p).g, texture(uInput, p - vec2(dx, 0.0)).b);

  float lines = uRes.y / 3.0;
  float s = sin(p.y * lines * 3.14159265);
  c *= mix(1.0, 0.55 + 0.45 * s * s, uScan);

  vec3 mask = vec3(0.8);
  int m = int(mod(gl_FragCoord.x, 3.0));
  mask[m] = 1.15;
  c *= mix(vec3(1.0), mask, 0.6 * uScan);

  c *= 1.0 + 0.3 * uScan; // brightness compensation
  float v = 1.0 - 0.6 * smoothstep(0.4, 1.5, length(q));
  o = vec4(clamp(c * v * inside, 0.0, 1.0), 1.0);
}`

export default shaderFilter({
  id: 'crt', name: 'CRT TV', category:'retro', icon: '📺',
  cost: 'light', needs: [],
  hint: 'Broadcasting live from 1985.',
  params: {
    curve: { type: 'range', label: 'Curvature', min: 0, max: 0.4, step: 0.01, default: 0.15 },
    scanlines: { type: 'range', label: 'Scanlines', min: 0, max: 1, step: 0.01, default: 0.6 }
  }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uCurve, num(params.curve, 0.15))
  gl.uniform1f(u.uScan, num(params.scanlines, 0.6))
})
