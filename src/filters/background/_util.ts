// Shared helpers for background filters (not a filter: '_' prefix).
import { deleteTarget, target, type Target } from '@engine/gl'

export const hex = (s: string): [number, number, number] => {
  const n = parseInt(s.replace('#', ''), 16) || 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Reuse `t` if it already has this size, else (re)create it. */
export function sized(gl: WebGL2RenderingContext, t: Target | null, w: number, h: number): Target {
  if (t && t.width === w && t.height === h) return t
  if (t) deleteTarget(gl, t)
  return target(gl, w, h)
}

/** 9-tap separable gaussian. uDir = one tap step in uv units (x or y). */
export const GAUSS_FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uDir;
void main() {
  vec4 s = texture(uTex, uv) * 0.2270270;
  s += (texture(uTex, uv + uDir) + texture(uTex, uv - uDir)) * 0.1945946;
  s += (texture(uTex, uv + uDir * 2.0) + texture(uTex, uv - uDir * 2.0)) * 0.1216216;
  s += (texture(uTex, uv + uDir * 3.0) + texture(uTex, uv - uDir * 3.0)) * 0.0540541;
  s += (texture(uTex, uv + uDir * 4.0) + texture(uTex, uv - uDir * 4.0)) * 0.0162162;
  o = s;
}`
