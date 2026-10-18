import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'

const SCENES = ['Space', 'Beach', 'Office', 'Gradient']

// All scenes are procedural. uv: x right, y DOWN (0 = top). p = uv with x scaled by aspect.
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform sampler2D uMask;
uniform float uTime; uniform float uAspect; uniform int uScene;

float hash(vec2 q) { q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
float noise(vec2 q) {
  vec2 i = floor(q), f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 q) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(q); q = q * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float box(vec2 q, vec2 lo, vec2 hi) { return step(lo.x, q.x) * step(q.x, hi.x) * step(lo.y, q.y) * step(q.y, hi.y); }

vec3 stars(vec2 p, float scale, float density) {
  vec2 g = p * scale;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  if (h < density) return vec3(0.0);
  vec2 off = (vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5) * 0.7;
  float d = length(f - off);
  float tw = 0.55 + 0.45 * sin(uTime * (1.5 + h * 4.0) + h * 60.0);
  vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.7), hash(id + 3.7));
  return tint * (smoothstep(0.09, 0.0, d) + 0.25 * smoothstep(0.3, 0.0, d)) * tw;
}

vec3 space(vec2 p) {
  vec3 col = vec3(0.01, 0.01, 0.035);
  float n = fbm(p * 1.8 + vec2(uTime * 0.012, 0.0));
  float n2 = fbm(p * 3.0 - n * 1.5 + 10.0 - vec2(0.0, uTime * 0.008));
  col += vec3(0.55, 0.12, 0.65) * pow(n2, 3.0) * 1.8;
  col += vec3(0.1, 0.35, 0.8) * pow(n, 4.0) * 1.6;
  col += stars(p, 45.0, 0.88);
  col += stars(p + 3.1, 110.0, 0.8) * 0.6;
  return col;
}

vec3 beach(vec2 p) {
  float y = uv.y;
  float horizon = 0.52;
  vec3 col = mix(vec3(0.25, 0.55, 0.92), vec3(0.85, 0.93, 1.0), clamp(y / horizon, 0.0, 1.0));
  vec2 sun = vec2(0.72 * uAspect, 0.2);
  float sd = length(p - sun);
  col += vec3(1.0, 0.85, 0.5) * 0.35 * smoothstep(0.35, 0.0, sd);
  col = mix(col, vec3(1.0, 0.97, 0.85), smoothstep(0.075, 0.068, sd));
  float cl = smoothstep(0.55, 0.78, fbm(vec2(p.x * 2.5 + uTime * 0.015, y * 7.0)));
  col = mix(col, vec3(1.0), cl * 0.75 * smoothstep(horizon, horizon - 0.15, y));
  float shore = 0.77 + 0.012 * sin(p.x * 6.0 + uTime * 0.9) + 0.006 * sin(p.x * 17.0 - uTime * 1.3);
  if (y > horizon) {
    float t = clamp((y - horizon) / (shore - horizon), 0.0, 1.0);
    vec3 sea = mix(vec3(0.05, 0.3, 0.55), vec3(0.15, 0.65, 0.75), t);
    float w = sin(p.x * 35.0 / (0.3 + t) + uTime * 1.6 + sin(p.x * 5.0 + uTime * 0.4) * 2.0) * sin(y * 140.0 - uTime * 2.0);
    sea += vec3(0.5) * smoothstep(0.75, 1.0, w) * (0.3 + 0.5 * t);
    float glint = smoothstep(0.09 + t * 0.12, 0.0, abs(p.x - sun.x)) * step(0.6, noise(vec2(p.x * 60.0, y * 300.0 - uTime * 3.0)));
    sea += vec3(1.0, 0.95, 0.75) * glint * 0.6;
    col = sea;
  }
  if (y > shore) {
    vec3 sand = vec3(0.94, 0.83, 0.62) - 0.06 * noise(p * 300.0) - 0.05 * fbm(p * 8.0);
    float wet = smoothstep(shore + 0.03, shore, y);
    sand = mix(sand, vec3(0.75, 0.65, 0.48), wet * 0.6);
    col = sand;
  }
  float foam = smoothstep(0.012, 0.0, abs(y - shore)) * (0.6 + 0.4 * noise(vec2(p.x * 40.0, uTime)));
  col = mix(col, vec3(1.0), foam);
  return col;
}

vec3 office(vec2 q) {
  vec3 col = mix(vec3(0.9, 0.87, 0.82), vec3(0.8, 0.77, 0.72), q.y);
  col += vec3(0.08, 0.06, 0.02) * smoothstep(0.8, 0.0, length((q - vec2(0.85, 0.05)) * vec2(uAspect, 1.0)));
  // window (left)
  vec2 wl = vec2(0.07, 0.12), wh = vec2(0.37, 0.56);
  if (box(q, wl - 0.012, wh + 0.012) > 0.5) {
    col = vec3(0.32, 0.33, 0.36);
    if (box(q, wl, wh) > 0.5) {
      vec2 w = (q - wl) / (wh - wl);
      vec3 sky = mix(vec3(0.45, 0.7, 0.95), vec3(0.85, 0.92, 0.98), w.y);
      float bx = floor(w.x * 9.0);
      float bh = 0.45 + 0.4 * hash(vec2(bx, 2.0));
      if (w.y > 1.0 - bh * 0.6) {
        sky = mix(vec3(0.55, 0.6, 0.68), vec3(0.4, 0.45, 0.52), hash(vec2(bx, 5.0)));
        vec2 win = fract(vec2(w.x * 54.0, w.y * 30.0));
        sky += vec3(0.25, 0.22, 0.1) * box(win, vec2(0.3), vec2(0.7)) * step(0.6, hash(floor(vec2(w.x * 54.0, w.y * 30.0))));
      }
      col = sky;
      float mull = max(step(abs(w.x - 0.5), 0.012), step(abs(w.y - 0.45), 0.015));
      col = mix(col, vec3(0.32, 0.33, 0.36), mull);
    }
  }
  // shelf (right) with books
  float shelfL = 0.6, shelfR = 0.93;
  for (int k = 0; k < 2; k++) {
    float py = k == 0 ? 0.36 : 0.6;
    if (q.x > shelfL && q.x < shelfR) {
      if (q.y > py - 0.17 && q.y < py) {
        float bi = floor(q.x * 70.0);
        float hb = 0.09 + 0.07 * hash(vec2(bi, py));
        float gap = step(0.82, hash(vec2(bi + 3.0, py)));
        if (q.y > py - hb && gap < 0.5 && (k == 1 || q.x < 0.84)) {
          float hc = hash(vec2(bi, py + 9.0));
          vec3 bc = hc < 0.25 ? vec3(0.7, 0.2, 0.2) : hc < 0.5 ? vec3(0.2, 0.35, 0.6) : hc < 0.75 ? vec3(0.85, 0.65, 0.2) : vec3(0.25, 0.5, 0.35);
          bc *= 0.75 + 0.35 * smoothstep(0.0, 0.5, fract(q.x * 70.0)) * smoothstep(1.0, 0.5, fract(q.x * 70.0));
          col = bc;
        }
      }
      if (q.y > py && q.y < py + 0.022) col = vec3(0.45, 0.3, 0.18) * (1.0 - 0.3 * (q.y - py) / 0.022);
      if (q.y > py + 0.022 && q.y < py + 0.035) col *= 0.85;
    }
  }
  // plant on top shelf
  vec2 pc = vec2(0.885, 0.27);
  vec2 d = (q - pc) * vec2(uAspect, 1.0);
  float leaves = smoothstep(0.075, 0.07, length(d * vec2(1.0, 1.3)) + 0.02 * sin(atan(d.y, d.x) * 7.0));
  col = mix(col, vec3(0.2, 0.55, 0.3) * (0.8 + 0.3 * noise(q * 80.0)), leaves);
  col = mix(col, vec3(0.75, 0.42, 0.28), box(q, vec2(0.865, 0.3), vec2(0.905, 0.36)));
  // floor + skirting
  if (q.y > 0.82) {
    float plank = floor((q.x + floor(q.y * 30.0) * 0.37) * 6.0);
    col = vec3(0.55, 0.38, 0.24) * (0.85 + 0.2 * hash(vec2(plank, floor(q.y * 30.0)))) * (0.9 + 0.1 * noise(vec2(q.x * 200.0, q.y * 20.0)));
    col *= 1.0 - 0.25 * step(0.92, fract(q.y * 30.0));
  } else if (q.y > 0.79) {
    col = vec3(0.95, 0.94, 0.92);
  }
  return col;
}

vec3 gradient(vec2 p) {
  vec2 a = vec2(0.3 * uAspect + 0.2 * sin(uTime * 0.21), 0.3 + 0.15 * cos(uTime * 0.17));
  vec2 b = vec2(0.7 * uAspect + 0.2 * cos(uTime * 0.13), 0.7 + 0.15 * sin(uTime * 0.19));
  vec3 ca = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + uTime * 0.03));
  vec3 cb = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + uTime * 0.03 + 0.45));
  float t = smoothstep(-0.4, 0.4, length(p - a) - length(p - b));
  vec3 col = mix(ca, cb, t);
  return mix(col, vec3(1.0), 0.2);
}

void main() {
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec3 bg = uScene == 0 ? space(p) : uScene == 1 ? beach(p) : uScene == 2 ? office(uv) : gradient(p);
  vec3 c = texture(uInput, uv).rgb;
  float m = smoothstep(0.3, 0.7, texture(uMask, uv).r);
  o = vec4(mix(bg, c, m), 1.0);
}`

const def: FilterDef = {
  id: 'replace', name: 'Scene Swap', category: 'background', icon: '🏝️',
  cost: 'medium', needs: ['segment'],
  hint: 'Beam yourself to space, the beach or a tidy office.',
  params: {
    scene: { type: 'select', label: 'Scene', options: SCENES, default: 'Space' }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    return {
      render(f, params) {
        if (!f.mask) { copy(gl, f.input); return }
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        bindTexture(gl, 1, f.mask, u.uMask)
        gl.uniform1f(u.uTime, f.time % 3600)
        gl.uniform1f(u.uAspect, f.width / f.height)
        gl.uniform1i(u.uScene, Math.max(0, SCENES.indexOf(String(params.scene ?? 'Space'))))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default def
