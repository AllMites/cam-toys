import { num, shaderFilter } from './_util'

// Luminance -> black, blue, purple, red, yellow, white.
const FS = `
uniform float uContrast;
vec3 palette(float t) {
  vec3 c0 = vec3(0.0), c1 = vec3(0.05, 0.05, 0.6), c2 = vec3(0.55, 0.05, 0.65);
  vec3 c3 = vec3(0.95, 0.1, 0.1), c4 = vec3(1.0, 0.85, 0.05), c5 = vec3(1.0);
  t = clamp(t, 0.0, 1.0) * 5.0;
  if (t < 1.0) return mix(c0, c1, t);
  if (t < 2.0) return mix(c1, c2, t - 1.0);
  if (t < 3.0) return mix(c2, c3, t - 2.0);
  if (t < 4.0) return mix(c3, c4, t - 3.0);
  return mix(c4, c5, t - 4.0);
}
void main() {
  // light blur so the heat map looks smooth
  vec2 px = 1.5 / uRes;
  vec3 c = texture(uInput, uv).rgb * 0.4
    + (texture(uInput, uv + vec2(px.x, 0.0)).rgb + texture(uInput, uv - vec2(px.x, 0.0)).rgb
     + texture(uInput, uv + vec2(0.0, px.y)).rgb + texture(uInput, uv - vec2(0.0, px.y)).rgb) * 0.15;
  float l = luma(c);
  l = (l - 0.5) * uContrast + 0.5;
  o = vec4(palette(l), 1.0);
}`

export default shaderFilter({
  id: 'thermal', name: 'Thermal Cam', category:'color', icon: '🌡️',
  cost: 'light', needs: [],
  hint: 'See the heat! (Well, the brightness.)',
  params: { contrast: { type: 'range', label: 'Contrast', min: 0.5, max: 2.5, step: 0.05, default: 1.3 } }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uContrast, num(params.contrast, 1.3))
})
