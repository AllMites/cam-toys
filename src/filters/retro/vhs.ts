import { num, shaderFilter } from './_util'

const FS = `
uniform float uAmount; uniform float uTracking;
vec3 toYiq(vec3 c) { return mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c; }
vec3 toRgb(vec3 c) { return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * c; }
void main() {
  float t = uTime;
  float line = floor(uv.y * 240.0);
  float jitter = (hash12(vec2(line, floor(t * 30.0))) - 0.5) * 0.0025 * uAmount;
  float wob = sin(uv.y * 5.0 + t * 1.3) * 0.002 * uAmount;
  // rolling tracking band
  float bandPos = fract(t * 0.11) * 1.3 - 0.15;
  float band = (1.0 - smoothstep(0.0, 0.05, abs(uv.y - bandPos))) * uTracking;
  float bandOff = band * (hash12(vec2(line, floor(t * 30.0) + 7.0)) - 0.3) * 0.04;
  // head-switching noise at the bottom of the frame
  float hs = smoothstep(0.955, 1.0, uv.y);
  float hsOff = hs * (0.02 + 0.02 * sin(uv.y * 300.0 + t * 20.0));
  vec2 p = vec2(uv.x + jitter + wob + bandOff + hsOff, uv.y);

  float y = toYiq(texture(uInput, p).rgb).x;
  // chroma: horizontally smeared and shifted right
  float co = (2.0 + 4.0 * uAmount) / uRes.x;
  vec2 ch = vec2(0.0);
  for (int i = 0; i < 4; i++) ch += toYiq(texture(uInput, p + vec2(co * float(i + 1), 0.0)).rgb).yz;
  ch *= 0.25 * 1.15;
  vec3 c = toRgb(vec3(y, ch));

  c += (hash12(uv * uRes + fract(t) * 517.0) - 0.5) * 0.09 * uAmount;
  c += band * hash12(vec2(floor(uv.x * uRes.x * 0.25), line + floor(t * 60.0))) * 0.35;
  c += hs * hash12(vec2(floor(uv.x * 80.0), line + t)) * 0.3;
  c = c * vec3(1.0, 0.97, 1.04) * 0.9 + 0.05; // washed-out tape look
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

export default shaderFilter({
  id: 'vhs', name: 'VHS Tape', category:'retro', icon: '📼',
  cost: 'light', needs: [],
  hint: 'Be kind, rewind.',
  params: {
    amount: { type: 'range', label: 'Wear', min: 0, max: 1, step: 0.01, default: 0.6 },
    tracking: { type: 'toggle', label: 'Tracking lines', default: true }
  }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uAmount, num(params.amount, 0.6))
  gl.uniform1f(u.uTracking, Boolean(params.tracking ?? true) ? 1 : 0)
})
