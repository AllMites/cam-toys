// Shared helpers for eye + expression filters. All geometry is in "aspect space":
// (x * width/height, y), so distances are in units of frame height and circles stay round.
// In shaders use `vec2 p = vec2(uv.x * uAspect, uv.y)` and sample with `vec2(p.x / uAspect, p.y)`.
import type { Frame, Pt } from '@engine/types'

export type V2 = [number, number]

export const hex = (s: string): [number, number, number] => {
  const n = parseInt(s.replace('#', ''), 16) || 0
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const asp = (p: Pt, a: number): V2 => [p.x * a, p.y]
export const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]]
export const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]]
export const scale = (a: V2, k: number): V2 => [a[0] * k, a[1] * k]
export const mid = (a: V2, b: V2): V2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
export const len = (a: V2): number => Math.hypot(a[0], a[1])
export const dist = (a: V2, b: V2): number => Math.hypot(a[0] - b[0], a[1] - b[1])
export const dot = (a: V2, b: V2): number => a[0] * b[0] + a[1] * b[1]
export const norm = (a: V2): V2 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}

/** Exponential approach of `cur` to `target` at `rate` per second (frame-rate independent). */
export const approach = (cur: number, target: number, dt: number, rate: number): number =>
  cur + (target - cur) * (1 - Math.exp(-Math.max(0, dt) * rate))

/** First face's landmarks (only if iris points are present) + blendshapes, or null. */
export function face(f: Frame): { pts: Pt[]; bs: Record<string, number> } | null {
  const pts = f.face?.faces[0]
  if (!pts || pts.length < 478) return null
  return { pts, bs: f.face?.blendshapes[0] ?? {} }
}

export interface Eye {
  iris: V2;     // iris centre
  r: number;    // iris radius
  c: V2;        // eye-opening centre
  axis: V2;     // unit vector along the eye corners
  halfW: number; // half corner distance
  halfH: number; // half lid gap (≈0 when blinking)
}

const EYE_A = { corners: [33, 133], lids: [159, 145] }
const EYE_B = { corners: [362, 263], lids: [386, 374] }

function eyeFor(pts: Pt[], a: number, ci: number, ring: number[], g: typeof EYE_A): Eye {
  const iris = asp(pts[ci], a)
  let r = 0
  for (const i of ring) r += dist(iris, asp(pts[i], a))
  r /= ring.length
  const c0 = asp(pts[g.corners[0]], a), c1 = asp(pts[g.corners[1]], a)
  const l0 = asp(pts[g.lids[0]], a), l1 = asp(pts[g.lids[1]], a)
  const cm = mid(c0, c1)
  return {
    iris, r: Math.max(r, 1e-4),
    c: mid(cm, mid(l0, l1)),
    axis: norm(sub(c1, c0)),
    halfW: Math.max(dist(c0, c1) / 2, 1e-4),
    halfH: Math.max(dist(l0, l1) / 2, 1e-4)
  }
}

/** Both eyes (iris 468 eye first, iris 473 eye second), paired to contours by proximity. */
export function eyes(pts: Pt[], a: number): [Eye, Eye] {
  const ca = mid(asp(pts[33], a), asp(pts[133], a))
  const cb = mid(asp(pts[362], a), asp(pts[263], a))
  const i0 = asp(pts[468], a)
  const swap = dist(i0, cb) < dist(i0, ca)
  const g0 = swap ? EYE_B : EYE_A, g1 = swap ? EYE_A : EYE_B
  return [eyeFor(pts, a, 468, [469, 470, 471, 472], g0), eyeFor(pts, a, 473, [474, 475, 476, 477], g1)]
}

export interface Mouth { c: V2; dir: V2; w: number }

/** Mouth centre, outward direction (perpendicular to the lip line, away from the nose) and width. */
export function mouth(pts: Pt[], a: number): Mouth {
  const up = asp(pts[13], a), lo = asp(pts[14], a)
  const l = asp(pts[61], a), r = asp(pts[291], a)
  const c = mid(up, lo)
  const line = norm(sub(r, l))
  let dir: V2 = [-line[1], line[0]]
  if (dot(dir, sub(c, asp(pts[1], a))) < 0) dir = [-dir[0], -dir[1]]
  return { c, dir, w: Math.max(dist(l, r), 1e-3) }
}
