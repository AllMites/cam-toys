# Adding a filter

A filter is one file: `src/filters/<category>/<id>.ts` that default-exports a `FilterDef`
(see `src/engine/types.ts`). It is registered automatically. No other file needs editing.

## Try it

```bash
npm run gallery
```

That opens `http://localhost:5199/src/engine/dev/gallery.html` in your browser. Tick filters to stack them (they run top to bottom). New files under `src/filters/` show up without a restart. The stats line shows fps, tracking ms and render ms. "Fake vcam subscriber" exercises the readback path the virtual camera uses.

## Minimal filter

```ts
import type { FilterDef } from '@engine/types'
import { bindTexture, drawFullscreen, program, uniforms } from '@engine/gl'

const FS = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D uInput; uniform float uAmount;
void main() { vec3 c = texture(uInput, uv).rgb; o = vec4(mix(c, 1.0 - c, uAmount), 1.0); }`

const def: FilterDef = {
  id: 'invert', name: 'Invert', category: 'color', icon: '🔄',
  cost: 'light',            // light = shader only, medium = 1 tracker, heavy = 2+ trackers or segment
  needs: [],                // which trackers to run: 'face' | 'hands' | 'gestures' | 'pose' | 'segment'
  hint: 'Flip every colour to its opposite.',
  params: { amount: { type: 'range', label: 'Amount', min: 0, max: 1, step: 0.01, default: 1 } },
  create(gl) {              // called when the layer is enabled; make GL objects here
    const p = program(gl, FS)
    const u = uniforms(gl, p)
    return {
      render(f, params) {   // once per camera frame
        gl.useProgram(p)
        bindTexture(gl, 0, f.input, u.uInput)
        gl.uniform1f(u.uAmount, Number(params.amount))
        drawFullscreen(gl)
      },
      dispose: () => gl.deleteProgram(p) // called when the layer is disabled/removed
    }
  }
}
export default def
```

Full examples: `src/filters/color/invert.ts` (shader) and `src/filters/face/face-dots.ts` (landmarks + points + blending).

## The render contract

- Before `render()` the engine binds `f.output` as the framebuffer, sets the viewport to `f.width × f.height` and disables blending. Draw your whole result into it.
- `f.input` is the previous layer's output (or the camera). Overlay filters start with `copy(gl, f.input)`, then draw on top.
- If you render to your own targets (`target()` in gl.ts), bind `f.output` and reset the viewport again before your final draw.
- Leave texture units, programs, VAOs and blending however you like; the engine resets what it needs. Don't leave a scissor or depth test on.
- `render()` throwing turns the layer off and shows the error. Toggling the layer off and on retries.
- `f.time` / `f.dt` are seconds (camera clock). Keep animation time-based, not frame-based.

## Coordinates (the one rule)

Every engine texture stores **row 0 = image top**, un-mirrored (the preview mirrors itself; friends see the un-mirrored output).

| You have | You want | Do |
|---|---|---|
| landmark `{x, y}` (0..1) | texture uv | use `(x, y)` as is |
| landmark | clip position in `f.output` | `toClip(pt)` → `(x*2-1, y*2-1)` (no Y flip) |
| landmark | pixels | `toPixels(pt, f.width, f.height)` |
| fullscreen `uv` in a shader | sample `f.input` | `texture(uInput, uv)` |

Landmarks are normalised to the frame, so a circle in pixels is an ellipse in uv: multiply x distances by `f.width / f.height` when you need round shapes.

## Tracker data

Only present when the filter lists the need and the model has loaded (first use takes ~1 s), so always handle `undefined`.

- `f.face` — `faces[i]`: 478 points ([index map](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png)); `blendshapes[i]`: `{ jawOpen, eyeBlinkLeft, mouthSmileLeft, … }` 0..1. One face is tracked.
- `f.hands` — `hands[i]`: 21 points; `handedness[i]`: `'Left' | 'Right'` from the person's point of view; `gestures[i]` (only with `needs: ['gestures']`): `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, `ILoveYou`, `None`.
- `f.pose` — `poses[0]`: 33 points.
- `f.mask` — person mask texture, R channel 0..1, same orientation as `f.input`. White (all person) until the segmenter has loaded.

## GL helpers (`@engine/gl`)

| Helper | Use |
|---|---|
| `program(gl, fs, vs?)` | compile + link; `fs` alone = fullscreen pass (gives `in vec2 uv`) |
| `uniforms(gl, p)` | `{ uName: location }` for every active uniform |
| `drawFullscreen(gl)` | draw one fullscreen triangle |
| `bindTexture(gl, unit, tex, loc)` | bind + set sampler |
| `copy(gl, tex, sx?, sy?)` | draw a texture over the bound target (`-1` mirrors an axis) |
| `texture(gl, src?)` | RGBA texture from an image/canvas/bitmap |
| `textureFromUrl(gl, url)` | `import url from './assets/hat.png?url'` |
| `textureFromSvg(gl, svg, w, h)` | `import svg from './assets/hat.svg?raw'` |
| `textureFromCanvas(gl, w, h, draw)` | draw text/emoji with a 2D context |
| `target(gl, w, h)` / `deleteTarget` | your own FBO for multi-pass effects |
| `toClip(pt)`, `toPixels(pt, w, h)` | landmark conversions |

Put sticker SVGs/PNGs in `src/filters/<category>/assets/`. Everything must be bundled locally (no remote URLs: the CSP blocks them).

## Performance budget

Target: an integrated GPU at 720p30. A light filter should cost < 1 ms render. Allocate GL objects and arrays in `create()`, not in `render()`. Watch the gallery stats with your filter alone; it must stay ≥ 24 fps unless it is tagged `heavy`.
