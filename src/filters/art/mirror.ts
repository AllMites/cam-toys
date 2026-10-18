import { pick, shaderFilter } from './_util'

const MODES = ['Left', 'Right', 'Top', 'Quad']

// Textures are un-mirrored: 'Left' copies the left half of the output image onto the right.
const FS = `
uniform int uMode;
void main() {
  vec2 p = uv;
  if (uMode == 0) p.x = p.x > 0.5 ? 1.0 - p.x : p.x;
  else if (uMode == 1) p.x = p.x < 0.5 ? 1.0 - p.x : p.x;
  else if (uMode == 2) p.y = p.y > 0.5 ? 1.0 - p.y : p.y;
  else p = abs(uv - 0.5) * 2.0; // four mirrored copies of the whole frame
  o = vec4(texture(uInput, p).rgb, 1.0);
}`

export default shaderFilter({
  id: 'mirror', name: 'Mirror World', category:'art', icon: '🪞',
  cost: 'light', needs: [],
  hint: 'Meet your perfectly symmetrical twin.',
  params: { mode: { type: 'select', label: 'Mirror', options: MODES, default: 'Left' } }
}, FS, (gl, u, _f, params) => {
  gl.uniform1i(u.uMode, pick(params.mode, MODES, 'Left'))
})
