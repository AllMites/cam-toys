import { num, shaderFilter } from './_util'

const FS = `
uniform float uAmount;
void main() {
  vec2 d = uv - 0.5;
  vec2 off = d * length(d) * uAmount * 0.12;
  float r = (texture(uInput, uv - off).r + texture(uInput, uv - off * 0.5).r) * 0.5;
  float g = texture(uInput, uv).g;
  float b = (texture(uInput, uv + off).b + texture(uInput, uv + off * 0.5).b) * 0.5;
  o = vec4(r, g, b, 1.0);
}`

export default shaderFilter({
  id: 'chromatic', name: 'Chromatic Split', category:'art', icon: '🌈',
  cost: 'light', needs: [],
  hint: 'Cheap-lens rainbow fringes.',
  params: { amount: { type: 'range', label: 'Amount', min: 0, max: 1, step: 0.01, default: 0.5 } }
}, FS, (gl, u, _f, params) => {
  gl.uniform1f(u.uAmount, num(params.amount, 0.5))
})
