import { num, shaderFilter } from './_util'

// Stepped time (12 Hz) so glitches snap like a broken stream; random bursts on top of a light base.
const FS = `
uniform float uAmount;
void main() {
  float t = floor(uTime * 12.0);
  float burst = step(0.65, hash12(vec2(t, 1.7)));
  float s = uAmount * (0.2 + 0.8 * burst);
  vec2 off = vec2(0.0);

  vec2 b1 = floor(uv * vec2(6.0, 18.0));
  float r1 = hash12(b1 + t * 1.31);
  if (r1 < 0.18 * s) off.x += (hash12(b1 + t + 3.1) - 0.5) * 0.25 * s;
  vec2 b2 = floor(uv * vec2(14.0, 40.0));
  float r2 = hash12(b2 + t * 0.71 + 9.0);
  if (r2 < 0.1 * s) off += (vec2(hash12(b2 + t), hash12(b2 - t)) - 0.5) * vec2(0.08, 0.03) * s;
  float row = floor(uv.y * 90.0);
  if (hash12(vec2(row, t + 5.0)) < 0.06 * s) off.x += (hash12(vec2(row, t)) - 0.5) * 0.12 * s;

  vec2 p = fract(uv + off);
  float split = (0.004 + 0.02 * burst) * uAmount * (hash12(vec2(t, 4.2)) * 2.0 - 1.0);
  vec3 c = vec3(texture(uInput, fract(p + vec2(split, 0.0))).r,
                texture(uInput, p).g,
                texture(uInput, fract(p - vec2(split, split * 0.3))).b);

  if (r1 > 1.0 - 0.05 * s) c = c.brg;
  if (r2 > 1.0 - 0.03 * s) c = 1.0 - c;
  if (r2 > 0.5 && r2 < 0.5 + 0.04 * s) c = floor(c * 3.0) / 3.0;
  c += (hash12(uv * uRes + t) - 0.5) * 0.06 * s;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

export default shaderFilter({
  id: 'glitch', name: 'Glitch', category:'retro', icon: '👾',
  cost: 'light', needs: [],
  hint: 'Your connection is fine. Probably.',
  params: { amount: { type: 'range', label: 'Chaos', min: 0, max: 1, step: 0.01, default: 0.6 } }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uAmount, num(params.amount, 0.6))
})
