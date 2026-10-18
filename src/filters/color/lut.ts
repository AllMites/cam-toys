import { num, pick, shaderFilter } from './_util'

const GRADES = ['Warm', 'Cool', 'Teal-Orange', 'B&W', 'Sepia', 'Pastel', 'Cyberpunk']

// Analytic colour grades (no LUT images). uGrade indexes GRADES.
const FS = `
uniform int uGrade; uniform float uAmount;
vec3 sat(vec3 c, float s) { return mix(vec3(luma(c)), c, s); }
vec3 contrast(vec3 c, float k) { return (c - 0.5) * k + 0.5; }
vec3 grade(vec3 c) {
  float l = luma(c);
  if (uGrade == 0) { // Warm
    c = c * vec3(1.08, 1.0, 0.86) + vec3(0.03, 0.01, 0.0);
    return sat(contrast(c, 1.05), 1.1);
  } else if (uGrade == 1) { // Cool
    c = c * vec3(0.9, 1.0, 1.1) + vec3(0.0, 0.01, 0.04);
    return sat(contrast(c, 1.05), 0.95);
  } else if (uGrade == 2) { // Teal-Orange: shadows teal, highlights orange
    vec3 teal = vec3(0.0, 0.5, 0.55), orange = vec3(1.0, 0.6, 0.25);
    vec3 tint = mix(teal, orange, smoothstep(0.15, 0.8, l));
    c = mix(c, tint * (l * 1.6 + 0.1), 0.35);
    return sat(contrast(c, 1.12), 1.15);
  } else if (uGrade == 3) { // B&W
    return vec3(smoothstep(0.02, 0.98, contrast(vec3(l), 1.15).r));
  } else if (uGrade == 4) { // Sepia
    vec3 s = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
    return mix(s, vec3(1.0, 0.95, 0.85) * s, 0.3) * 0.95 + 0.03;
  } else if (uGrade == 5) { // Pastel: lifted blacks, soft saturation, pink-mint tint
    c = sat(c, 0.7);
    c = mix(vec3(0.22, 0.2, 0.25), vec3(1.0, 0.97, 1.0), c);
    return c + vec3(0.03, 0.0, 0.04) * (1.0 - l);
  }
  // Cyberpunk: magenta highlights, cyan shadows, punchy
  vec3 shadow = vec3(0.05, 0.25, 0.45), high = vec3(1.0, 0.25, 0.85);
  vec3 tint = mix(shadow, high, smoothstep(0.1, 0.85, l));
  c = mix(c, tint * (l * 1.2 + 0.1), 0.4);
  return sat(contrast(c, 1.2), 1.35);
}
void main() {
  vec3 c = texture(uInput, uv).rgb;
  o = vec4(clamp(mix(c, grade(c), uAmount), 0.0, 1.0), 1.0);
}`

export default shaderFilter({
  id: 'lut', name: 'Colour Grades', category:'color', icon: '🎞️',
  cost: 'light', needs: [],
  hint: 'Instant movie look. Try Cyberpunk!',
  params: {
    grade: { type: 'select', label: 'Grade', options: GRADES, default: 'Warm' },
    intensity: { type: 'range', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.85 }
  }
}, FS, (gl, u, _f, params) => {
  gl.uniform1i(u.uGrade, pick(params.grade, GRADES, 'Warm'))
  gl.uniform1f(u.uAmount, num(params.intensity, 0.85))
})
