# Plan: Phase 3 — Engine

## Summary
Build `createEngine()` (the `EngineApi` from the frozen `src/engine/types.ts`): webcam capture, lazy MediaPipe trackers, a WebGL2 ping-pong pass chain driven by `Layer[]`, a mirrored preview + un-mirrored output FBO, async PBO readback → BGR24 for the vcam, stats and snapshot. Ship GL helpers for filter authors, two sample filters and a dev gallery.

## User Story
As a Phase 5 filter author (and Phase 6 integrator), I want a working engine that runs any registered `FilterDef` stacked on the live camera, so that I can build and test filters and feed frames to the virtual camera.

## Problem → Solution
Contract only (types.ts) → running engine + gallery proving 2 stacked filters.

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/cam-toys-desktop.prd.md`
- **PRD Phase**: 3 — Engine
- **Estimated Files**: ~14

## UX Design
Internal change; only UX is the dev gallery (`npm run gallery`): camera preview, a checkbox per registered filter, fps/track/render stats line.

## Mandatory Reading
| Priority | File | Why |
|---|---|---|
| P0 | `src/engine/types.ts` | Frozen contract (Frame, FilterDef, EngineApi, results) |
| P0 | `src/filters/index.ts` | `filters: FilterDef[]` registry via `import.meta.glob('./*/*.ts')` |
| P1 | `src/main/settings.test.ts` | Test style: `node:test` + `node:assert/strict`, import with `.ts` suffix |
| P1 | `src/renderer/index.html` | CSP: `'self'`, `'wasm-unsafe-eval'`, blob workers, no remote origins |
| P2 | `electron.vite.config.ts` | Aliases `@engine`, `@filters` |

## External Research
KEY_INSIGHT: `@mediapipe/tasks-vision@1.1.1` exports only `.`; wasm lives in `node_modules/@mediapipe/tasks-vision/wasm/`. A `WasmFileset` is just `{ wasmLoaderPath, wasmBinaryPath }`.
APPLIES_TO: Wasm bundling — import both files with Vite `?url` via a relative path (bypasses `exports`); Vite copies them to `out/renderer/assets` at build. No copy script needed.
GOTCHA: Loader is injected as `<script crossOrigin="anonymous">`, models are `fetch()`ed. **Verified** in Electron 44 under `loadFile` (file://) with the app's CSP: both `fetch(file)` and the crossorigin script load. (scratch test, not committed)

KEY_INSIGHT: Each task with `delegate: 'GPU'` and no `canvas` makes its own OffscreenCanvas GL context. `MPMask.getAsWebGLTexture()` lives in that context, not ours.
APPLIES_TO: Segment → copy mask with `getAsFloat32Array()` inside the callback, convert to bytes, upload to our own R8 texture. Never share our GL context with MediaPipe (it does not restore GL state).

KEY_INSIGHT: MediaPipe handedness assumes a mirrored (selfie) input. We feed un-mirrored frames → swap Left/Right.
APPLIES_TO: HandsResult conversion.

KEY_INSIGHT: `GestureRecognizer` also returns landmarks + handedness. When `gestures` is needed, run it *instead of* HandLandmarker (one hand model, not two).

## Key design decisions
- **Orientation**: every engine texture/FBO stores row 0 = image top (WebGL `texImage2D(video)` without FLIP_Y does this). So uv == landmark (x, y) and clip = (x*2-1, y*2-1). Only the final canvas blit flips Y (and mirrors X for the preview). `readPixels` on the output FBO is therefore already top-down; the converter only swizzles RGBA→BGR.
- **Filters never get `output: null`**: chain is always FBO ping-pong; engine does the final blits.
- **Loop**: `video.requestVideoFrameCallback` → one upload + one tracker run + one render per new camera frame.
- **Resolution/fps**: `createEngine({ width, height, fps })` (EngineApi.start has only canvas + deviceId). Output FBO = requested size; chain runs at actual video size.
- **Models**: committed to `resources/models/` (≈25 MB), version-pinned URLs in `scripts/fetch-models.mjs`. Why: offline dev, reproducible CI/installer builds, no install-time network; Apache-2.0 allows redistribution.
- **Gallery**: standalone Vite dev server (`npm run gallery`, `src/engine/dev/vite.config.ts`, root `src/engine/dev`). The electron-vite renderer root is `src/renderer`, so an extra input outside it isn't servable in dev without touching main/renderer. Gallery runs in any Chromium at localhost (camera is allowed on localhost).

## Files to Change
| File | Action |
|---|---|
| `src/engine/engine.ts` | CREATE `createEngine()` |
| `src/engine/camera.ts` | CREATE getUserMedia/listCameras/error mapping |
| `src/engine/trackers.ts` | CREATE lazy MediaPipe manager + result conversion |
| `src/engine/gl.ts` | CREATE helpers for filters + engine |
| `src/engine/convert.ts` + `convert.test.ts` | CREATE RGBA→BGR24 + test |
| `src/engine/assets.d.ts` | CREATE `?url` module typing if not provided |
| `src/engine/dev/{gallery.html,gallery.ts,vite.config.ts}` | CREATE |
| `src/filters/color/invert.ts`, `src/filters/face/face-dots.ts` | CREATE |
| `scripts/fetch-models.mjs`, `resources/models/*` | CREATE |
| `docs/ADDING_A_FILTER.md` | CREATE |
| `package.json` | UPDATE dep `@mediapipe/tasks-vision`, scripts `gallery`, `models` |

## NOT Building
- Web worker for trackers (main thread first; measure).
- Auto-degrade, heavy warnings, presets, vcam wiring (Phase 6).
- Changes to types.ts (report needs instead).

## Tasks
1. fetch-models script + download/commit models. VALIDATE: files exist, sizes sane.
2. convert.ts + test. VALIDATE: `npm test`.
3. gl.ts (program/quad/texture/FBO helpers, landmark→clip). VALIDATE: typecheck.
4. camera.ts, trackers.ts, engine.ts. VALIDATE: typecheck.
5. invert + face-dots. VALIDATE: typecheck.
6. Gallery + `npm run gallery`. VALIDATE: vite starts, page compiles (no camera check by agent).
7. ADDING_A_FILTER.md. 8. `npm run build` + commit.

## Validation Commands
```bash
npm run typecheck
npm test
npm run build
```
Manual (user): `npm run gallery`, open the URL, tick Invert + Face dots → both stacked, stats ≥ 30 fps.

## Risks
| Risk | Mitigation |
|---|---|
| Hidden/tray window throttles rVFC/rAF → vcam stalls | Phase 6: `webPreferences.backgroundThrottling: false` (main is not ours; reported) |
| Main-thread inference + sync mask readback costs fps on iGPU | Downscale to 640x360; segment only when needed; measure via stats; worker later |
| 25 MB binaries in git | Documented decision; script can refetch |
