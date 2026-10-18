import { num, shaderFilter } from './_util'

const FS = `
uniform float uNoise;
void main() {
  vec2 px = 3.0 / uRes;
  float l = luma(texture(uInput, uv).rgb);
  // cheap bloom: brightest of a few taps around
  float b = 0.0;
  b += luma(texture(uInput, uv + vec2(px.x, px.y)).rgb);
  b += luma(texture(uInput, uv + vec2(-px.x, px.y)).rgb);
  b += luma(texture(uInput, uv + vec2(px.x, -px.y)).rgb);
  b += luma(texture(uInput, uv + vec2(-px.x, -px.y)).rgb);
  b = max(b * 0.25 - 0.6, 0.0) * 1.5;
  l = pow(clamp(l * 1.6 + 0.04, 0.0, 1.0), 0.8) + b;
  float n = hash12(floor(uv * uRes * 0.5) + fract(uTime * 7.0) * 113.0) - 0.5;
  l += n * uNoise;
  l *= 0.92 + 0.08 * sin(uv.y * uRes.y * 1.4); // faint scanlines
  float v = 1.0 - smoothstep(0.35, 1.0, length((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0)) * 0.95);
  l *= v;
  vec3 c = vec3(0.1, 1.0, 0.25) * l + vec3(0.6, 1.0, 0.6) * max(l - 0.85, 0.0);
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

export default shaderFilter({
  id: 'night-vision', name: 'Night Vision', category:'color', icon: '🥽',
  cost: 'light', needs: [],
  hint: 'Stealth mode activated.',
  params: { noise: { type: 'range', label: 'Noise', min: 0, max: 0.5, step: 0.01, default: 0.18 } }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uNoise, num(params.noise, 0.18))
})
