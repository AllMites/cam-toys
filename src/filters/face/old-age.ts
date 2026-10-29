import type { FilterDef } from '@engine/types'
import { bindTexture, copy, drawFullscreen, program, uniforms } from '@engine/gl'
import { OVAL, SD_POLY, faceGeo } from './_util'

// One pass. Everything after the oval mask works in face-local coords `q`:
// origin nose tip, x = head right, y = head down, units = face widths (so it sticks to the face).
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput;
uniform vec2 uRes, uO, uR, uD;
uniform float uW;
uniform vec2 uPoly[36];
uniform vec4 uBox;
uniform vec2 uEyeL, uEyeR, uLidL, uLidR, uWingL, uWingR, uMouthL, uMouthR, uBrowL, uBrowR;
uniform float uTopV, uNoseV, uLipTopV, uLipBotV, uChinV;
uniform float uAge, uWrinkle, uBeard, uGrey;
${SD_POLY}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float ln(float d, float w) { return exp(-d * d / (w * w)); }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
// 1 inside [a, b], soft edges of width f
float band(float x, float a, float b, float f) { return smoothstep(a - f, a, x) * (1.0 - smoothstep(b, b + f, x)); }
float crow(vec2 q, vec2 e) {
  vec2 v = q - e; v.x *= sign(e.x);           // +x = away from the face centre
  float r = length(v), a = atan(v.y, v.x);
  float m = smoothstep(0.012, 0.03, r) * (1.0 - smoothstep(0.07, 0.13, r)) * (1.0 - smoothstep(0.6, 1.0, abs(a)));
  return m * pow(0.5 + 0.5 * cos(a * 10.0 + r * 20.0), 10.0);
}
float bag(vec2 q, vec2 l) {
  vec2 v = (q - l) / vec2(0.085, 0.04);
  float r = length(v), down = smoothstep(0.0, 0.7, v.y / max(r, 1e-3));
  return (ln(r - 1.0, 0.14) + 0.5 * ln(r - 1.6, 0.12)) * down;
}
void main() {
  vec4 c = texture(uInput, uv);
  vec2 px = uv * uRes;
  if (px.x < uBox.x || px.y < uBox.y || px.x > uBox.z || px.y > uBox.w) { o = c; return; }
  float feather = uW * 0.06;
  float sd = sdPoly(px);
  float face = 1.0 - smoothstep(-feather, feather * 0.3, sd);
  float jaw = 1.0 - smoothstep(-feather * 0.2, feather * 0.4, sd);
  vec2 d = px - uO;
  vec2 q = vec2(dot(d, uR), dot(d, uD)) / uW;
  vec3 col = c.rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));

  // Skin: duller, slightly sallow, a few age spots.
  float spots = smoothstep(0.7, 0.85, vnoise(q * 22.0)) * smoothstep(0.45, 0.65, vnoise(q * 6.0 + 7.0));
  vec3 aged = mix(col, lum * vec3(1.05, 1.0, 0.88), 0.35) * (1.0 - spots * 0.22 * vec3(0.75, 0.95, 1.25));
  col = mix(col, aged, face * uAge);

  // Wrinkles: a darkening amount.
  float w = 0.0;
  float browV = min(uBrowL.y, uBrowR.y);
  float fh = band(q.y, uTopV + 0.06, browV - 0.04, 0.04) * (1.0 - smoothstep(0.18, 0.34, abs(q.x)));
  float fv = (q.y + 0.006 * sin(q.x * 25.0)) / 0.045;
  w += fh * pow(0.5 + 0.5 * cos(6.2832 * fv), 12.0);
  w += 0.8 * (crow(q, uEyeL) + crow(q, uEyeR));
  w += 0.7 * (bag(q, uLidL) + bag(q, uLidR));
  float hw = 0.5 * abs(uMouthR.x - uMouthL.x);
  for (int k = 0; k < 2; k++) {
    vec2 wing = k == 0 ? uWingL : uWingR, mc = k == 0 ? uMouthL : uMouthR;
    float s = sign(mc.x);
    w += ln(seg(q, wing + vec2(0.03 * s, 0.0), mc + vec2(0.035 * s, 0.015)), 0.008);           // nasolabial
    w += 0.6 * ln(seg(q, mc + vec2(0.012 * s, 0.025), vec2(mc.x * 0.9, uChinV - 0.09)), 0.007); // marionette
  }
  w += 0.35 * (vnoise(q * vec2(70.0, 160.0)) - 0.5);                                            // crepey skin
  col *= 1.0 - clamp(w, -0.3, 1.0) * 0.4 * uWrinkle * uAge * face;

  // Eyebrows: dark hair pixels go grey.
  float browM = ln(length((q - uBrowL) / vec2(0.11, 0.035)), 1.0) + ln(length((q - uBrowR) / vec2(0.11, 0.035)), 1.0);
  float hairish = 1.0 - smoothstep(0.25, 0.5, lum);
  vec3 greyHair = vec3(0.86, 0.85, 0.82);
  col = mix(col, greyHair * (0.55 + 0.6 * lum), clamp(browM, 0.0, 1.0) * hairish * uGrey * 0.85);

  // Facial hair: mustache + beard that follows the jaw and hangs past the chin with length.
  if (uBeard > 0.001) {
    vec2 mc = 0.5 * (uMouthL + uMouthR); mc.y = 0.5 * (uLipTopV + uLipBotV);
    float lip = 1.0 - smoothstep(0.85, 1.05, length((q - mc) / vec2(hw * 1.05, 0.5 * (uLipBotV - uLipTopV) + 0.012)));
    float ax = abs(q.x - mc.x);
    float mus = band(q.y, uNoseV + 0.012, uLipTopV + 0.01 + 0.06 * smoothstep(0.4 * hw, 1.2 * hw, ax), 0.012) * (1.0 - smoothstep(hw * 1.15, hw * 1.35, ax));
    float top = mix(uLipTopV, uNoseV - 0.04, smoothstep(hw * 1.1, 0.45, ax));
    float hang = 0.2 * smoothstep(0.3, 1.0, uBeard);
    float below = band(q.y, uChinV - 0.1, uChinV + hang * (1.0 - pow(ax / 0.3, 2.0)), 0.03) * (1.0 - smoothstep(0.22, 0.3, ax));
    float m = max(mus, smoothstep(top, top + 0.04, q.y) * max(jaw, below)) * (1.0 - lip);
    float n = 0.6 * vnoise(vec2(q.x * 260.0, q.y * 28.0)) + 0.4 * vnoise(vec2(q.x * 520.0 + 3.0, q.y * 55.0));
    float stubble = step(0.72, hash(floor(q * 420.0))) * 0.7;
    float full = smoothstep(0.3, 0.6, n);
    float dens = mix(stubble, full, smoothstep(0.2, 0.55, uBeard)) * clamp(uBeard * 4.0, 0.0, 1.0);
    vec3 hc = mix(vec3(0.33, 0.3, 0.28), greyHair, uGrey) * (0.7 + 0.45 * n);
    col = mix(col, hc, m * dens);
  }
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

const oldAge: FilterDef = {
  id: 'old-age', name: 'Old Age', category: 'face', icon: '👴',
  cost: 'medium', needs: ['face'],
  hint: 'Fast-forward 50 years: wrinkles, grey brows, a beard.',
  params: {
    age: { type: 'range', label: 'Age', min: 0, max: 1, step: 0.01, default: 0.85 },
    wrinkles: { type: 'range', label: 'Wrinkles', min: 0, max: 1, step: 0.01, default: 0.8 },
    beard: { type: 'range', label: 'Beard', min: 0, max: 1, step: 0.01, default: 0.6 },
    grey: { type: 'range', label: 'Grey', min: 0, max: 1, step: 0.01, default: 0.85 }
  },
  create(gl) {
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    const poly = new Float32Array(72)
    return {
      render(f, params) {
        const g = faceGeo(f)
        if (!g) { copy(gl, f.input); return }
        const [ox, oy] = g.p(1)
        const loc = (i: number): [number, number] => {
          const [x, y] = g.p(i), dx = x - ox, dy = y - oy
          return [(dx * g.right[0] + dy * g.right[1]) / g.W, (dx * g.down[0] + dy * g.down[1]) / g.W]
        }
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        for (let i = 0; i < 36; i++) {
          const [x, y] = g.p(OVAL[i])
          poly[i * 2] = x; poly[i * 2 + 1] = y
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
        }
        const pad = g.W * 0.3 // beard hangs below the chin
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform2f(u.uRes, f.width, f.height)
        gl.uniform2f(u.uO, ox, oy)
        gl.uniform2fv(u.uR, g.right)
        gl.uniform2fv(u.uD, g.down)
        gl.uniform1f(u.uW, g.W)
        gl.uniform2fv(u.uPoly, poly)
        gl.uniform4f(u.uBox, x0 - pad, y0 - pad, x1 + pad, y1 + pad)
        const v2: [string, number][] = [['uEyeL', 33], ['uEyeR', 263], ['uLidL', 145], ['uLidR', 374], ['uWingL', 129], ['uWingR', 358], ['uMouthL', 61], ['uMouthR', 291], ['uBrowL', 105], ['uBrowR', 334]]
        for (const [name, i] of v2) gl.uniform2fv(u[name], loc(i))
        gl.uniform1f(u.uTopV, loc(10)[1])
        gl.uniform1f(u.uNoseV, loc(2)[1])
        gl.uniform1f(u.uLipTopV, loc(0)[1])
        gl.uniform1f(u.uLipBotV, loc(17)[1])
        gl.uniform1f(u.uChinV, loc(152)[1])
        gl.uniform1f(u.uAge, Number(params.age ?? 0.85))
        gl.uniform1f(u.uWrinkle, Number(params.wrinkles ?? 0.8))
        gl.uniform1f(u.uBeard, Number(params.beard ?? 0.6))
        gl.uniform1f(u.uGrey, Number(params.grey ?? 0.85))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p)
    }
  }
}
export default oldAge
