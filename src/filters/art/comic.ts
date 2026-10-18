import { num, shaderFilter } from './_util'

const FS = `
uniform float uLevels; uniform float uHalftone;
float L(vec2 p) { return luma(texture(uInput, p).rgb); }
void main() {
  vec2 px = max(1.0, uRes.y / 720.0) / uRes;
  float tl = L(uv + px * vec2(-1.0, -1.0)), t = L(uv + px * vec2(0.0, -1.0)), tr = L(uv + px * vec2(1.0, -1.0));
  float ml = L(uv + px * vec2(-1.0, 0.0)), mr = L(uv + px * vec2(1.0, 0.0));
  float bl = L(uv + px * vec2(-1.0, 1.0)), b = L(uv + px * vec2(0.0, 1.0)), br = L(uv + px * vec2(1.0, 1.0));
  float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
  float gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
  float edge = smoothstep(0.22, 0.5, length(vec2(gx, gy)));

  vec3 c = texture(uInput, uv).rgb;
  c = mix(vec3(luma(c)), c, 1.35); // punchier colour
  c = clamp(floor(c * uLevels + 0.5) / uLevels, 0.0, 1.0);

  // halftone dots in the shadows (45 degree grid)
  vec2 g = mat2(0.7071, 0.7071, -0.7071, 0.7071) * (uv * uRes) / (6.0 * max(1.0, uRes.y / 720.0));
  float r = clamp(0.7 - luma(c), 0.0, 1.0) * 0.75;
  float dotMask = (1.0 - smoothstep(r - 0.06, r + 0.06, length(fract(g) - 0.5))) * smoothstep(0.0, 0.08, r);
  c = mix(c, c * 0.55, dotMask * uHalftone);

  o = vec4(mix(c, vec3(0.04, 0.03, 0.06), edge), 1.0);
}`

export default shaderFilter({
  id: 'comic', name: 'Comic Book', category:'art', icon: '💥',
  cost: 'light', needs: [],
  hint: 'POW! Straight out of a comic.',
  params: {
    levels: { type: 'range', label: 'Colour bands', min: 2, max: 8, step: 1, default: 4 },
    halftone: { type: 'toggle', label: 'Halftone dots', default: true }
  }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uLevels, Math.max(1, num(params.levels, 4)))
  gl.uniform1f(u.uHalftone, Boolean(params.halftone ?? true) ? 1 : 0)
})
