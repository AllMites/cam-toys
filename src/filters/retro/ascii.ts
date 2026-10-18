import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, textureFromCanvas, uniforms } from '@engine/gl'
import { HEADER, num } from './_util'

const CHARS = ' .:-=+*#%@'
const G = 32 // atlas glyph cell, px

const FS = `
uniform sampler2D uAtlas; uniform float uCell; uniform int uColor;
void main() {
  vec2 cells = uRes / uCell;
  vec2 cid = floor(uv * cells);
  vec2 local = fract(uv * cells);
  vec3 c = texture(uInput, (cid + 0.5) / cells).rgb;
  float l = clamp((luma(c) - 0.04) * 1.25, 0.0, 1.0);
  float idx = min(floor(l * ${CHARS.length}.0), ${CHARS.length - 1}.0);
  float g = texture(uAtlas, vec2((idx + local.x) / ${CHARS.length}.0, local.y)).r;
  vec3 col = uColor == 1 ? clamp(c * 1.4 + 0.08, 0.0, 1.0) : vec3(0.25, 1.0, 0.4);
  o = vec4(col * g, 1.0);
}`

const def: FilterDef = {
  id: 'ascii', name: 'ASCII Art', category:'retro', icon: '🔤',
  cost: 'light', needs: [],
  hint: 'You, rendered in pure text.',
  params: {
    cell: { type: 'range', label: 'Cell size', min: 6, max: 24, step: 1, default: 10 },
    color: { type: 'toggle', label: 'Real colours', default: false }
  },
  create(gl) {
    const p = program(gl, HEADER + FS)
    const u = uniforms(gl, p)
    const atlas = textureFromCanvas(gl, G * CHARS.length, G, (ctx) => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, G * CHARS.length, G)
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(G * 0.85)}px Consolas, "Courier New", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let i = 0; i < CHARS.length; i++) ctx.fillText(CHARS[i], i * G + G / 2, G / 2 + 1)
    })
    return {
      render(f, params) {
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        bindTexture(gl, 1, atlas, u.uAtlas)
        gl.uniform2f(u.uRes, f.width, f.height)
        gl.uniform1f(u.uCell, Math.max(4, num(params.cell, 10) * (f.height / 720)))
        gl.uniform1i(u.uColor, Boolean(params.color ?? false) ? 1 : 0)
        drawFullscreen(gl)
      },
      dispose() {
        gl.deleteProgram(p)
        gl.deleteTexture(atlas)
      }
    }
  }
}
export default def
