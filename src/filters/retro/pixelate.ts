import { num, shaderFilter } from './_util'

// PICO-8 palette
const PAL = ['000000', '1D2B53', '7E2553', '008751', 'AB5236', '5F574F', 'C2C3C7', 'FFF1E8',
  'FF004D', 'FFA300', 'FFEC27', '00E436', '29ADFF', '83769C', 'FF77A8', 'FFCCAA']
const glslPal = PAL.map((h) => {
  const n = parseInt(h, 16)
  return `vec3(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(4)).join(', ')})`
}).join(',\n  ')

const FS = `
uniform float uSize; uniform int uPalette;
const vec3 PAL[16] = vec3[16](
  ${glslPal});
void main() {
  vec2 cells = uRes / uSize;
  vec2 cid = floor(uv * cells);
  vec3 c = texture(uInput, (cid + 0.5) / cells).rgb;
  if (uPalette == 1) {
    // 2x2 ordered dither per cell, then nearest palette colour
    float bayer = mod(mod(cid.x, 2.0) * 2.0 + mod(cid.y, 2.0) * 3.0, 4.0) * 0.25;
    c = clamp(c * 1.1 + (bayer - 0.375) * 0.15, 0.0, 1.0);
    vec3 best = PAL[0]; float bd = 1e9;
    for (int i = 0; i < 16; i++) {
      vec3 d = c - PAL[i];
      float dd = dot(d * d, vec3(0.3, 0.59, 0.11));
      if (dd < bd) { bd = dd; best = PAL[i]; }
    }
    c = best;
  }
  o = vec4(c, 1.0);
}`

export default shaderFilter({
  id: 'pixelate', name: 'Pixel Art', category:'retro', icon: '🕹️',
  cost: 'light', needs: [],
  hint: 'Turn on 8-bit colours for full arcade mode.',
  params: {
    size: { type: 'range', label: 'Block size', min: 4, max: 40, step: 1, default: 12 },
    palette: { type: 'toggle', label: '8-bit colours', default: false }
  }
}, FS, (gl, u, f, params) => {
  gl.uniform1f(u.uSize, Math.max(1, num(params.size, 12) * (f.height / 720)))
  gl.uniform1i(u.uPalette, Boolean(params.palette ?? false) ? 1 : 0)
})
