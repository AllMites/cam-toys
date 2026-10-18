// Shared helpers for shader-only filters (also re-exported by color/_util.ts and art/_util.ts).
import type { FilterDef, Frame, ParamValues } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'

export type Uniforms = Record<string, WebGLUniformLocation>
export type Setter = (gl: WebGL2RenderingContext, u: Uniforms, f: Frame, params: ParamValues) => void

/** Prepended to every fullscreen fragment body: uInput (unit 0), uRes (px), uTime (s). */
export const HEADER = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform vec2 uRes; uniform float uTime;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`

/** Single fullscreen pass over f.input. `body` is GLSL after HEADER (extra uniforms + main). */
export function shaderFilter(meta: Omit<FilterDef, 'create'>, body: string, set?: Setter): FilterDef {
  return {
    ...meta,
    create(gl) {
      const p = program(gl, HEADER + body)
      const u = uniforms(gl, p)
      return {
        render(f, params) {
          gl.useProgram(p)
          bindTexture(gl, 0, f.input, u.uInput)
          gl.uniform2f(u.uRes, f.width, f.height)
          gl.uniform1f(u.uTime, f.time)
          set?.(gl, u, f, params)
          drawFullscreen(gl)
        },
        dispose: () => gl.deleteProgram(p)
      }
    }
  }
}

export const num = (v: unknown, d: number): number => {
  const n = Number(v ?? d)
  return Number.isFinite(n) ? n : d
}
export const pick = (v: unknown, options: string[], d: string): number => {
  const i = options.indexOf(String(v ?? d))
  return i < 0 ? Math.max(0, options.indexOf(d)) : i
}
