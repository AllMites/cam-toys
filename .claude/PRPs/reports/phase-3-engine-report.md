# Implementation Report: Phase 3 — Engine

## Summary
`createEngine(opts?)` in `src/engine/engine.ts` implements the frozen `EngineApi`: camera → lazy MediaPipe trackers → WebGL2 ping-pong pass chain → mirrored preview + un-mirrored output FBO → async PBO readback → BGR24 `onFrame`. Includes stats, PNG snapshot, GL helpers (`src/engine/gl.ts`), two sample filters, a dev gallery (`npm run gallery`) and `docs/ADDING_A_FILTER.md`.

## API for Phase 6
```ts
import { createEngine } from '@engine/engine'
const engine = createEngine({ width: 1280, height: 720, fps: 30 }) // = settings; recreate (or stop/start a new one) to change
await engine.start(canvas, settings.cameraId ?? undefined)           // rejects + onError with friendly text
engine.onFrame((bgr, w, h) => vcam.send(bgr))                        // bgr buffer is REUSED each frame; copy if kept
```
- No subscribers to `onFrame` → no output pass, no readback.
- `onError` messages are user-facing ("Camera is busy. Close other apps…", "Camera permission was denied.", "Camera was disconnected.", filter crash → layer turned off).
- `snapshot()` → PNG of the un-mirrored output (what friends see).

## Validation
| Level | Status | Notes |
|---|---|---|
| Typecheck | pass | `npm run typecheck` |
| Unit tests | pass | `src/engine/convert.test.ts` (2 tests, RGBA→BGR) |
| Build | pass | `npm run build` |
| Headless E2E | pass | Electron 44, **hidden** window, Chromium fake camera, gallery: invert + face-dots stacked at 20 fps (fake cam rate), readback 20 frames/s at 1280x720 |
| All trackers | pass | Temporary probe filter needing face+gestures+pose+segment: all loaded with the GPU delegate; results + mask reached `Frame` (probe deleted) |
| Prod path | pass | Gallery built with Vite and loaded over `file://` with the app CSP: wasm + `.task` models load, face tracker runs |
| Real camera / face-dots visuals / iGPU fps | **not run** | needs the user: `npm run gallery` |

## Deviations
- **Frame source is `MediaStreamTrackProcessor` (VideoFrames), not `<video>` + rVFC.** Measured in a hidden Electron window with `backgroundThrottling:false`: rVFC and rAF ran at ~1/s, the processor at full rate. The app lives in the tray, so rVFC would have frozen the vcam. No `<video>` element, so "wait for videoWidth > 0" is moot: each VideoFrame carries its real size.
- **Wasm is not copied by a script**: `?url` imports in `trackers.ts` make Vite emit `vision_wasm_internal.{js,wasm}` and the models as hashed assets in `out/renderer/assets`. Verified in a build.
- **Models committed** (`resources/models/`, 26 MB) rather than fetched in postinstall: offline dev, reproducible CI/installer, no install-time network; Apache-2.0 permits redistribution. `npm run models -- --force` refreshes them.
- **Gallery is a standalone Vite server** (`src/engine/dev/vite.config.mjs`, rooted at the repo so new filter files appear live), not an electron-vite renderer input: the renderer root is `src/renderer`, so a page under `src/engine` can't be served in dev without touching main/renderer. `electron.vite.config.ts` untouched.
- **Segment mask** is copied to CPU (`getAsFloat32Array`) and uploaded to our own R8 texture: MediaPipe's mask texture lives in its own GL context, and sharing ours would let it clobber GL state.
- `tsconfig.web.json`: added `noEmit` + `allowImportingTsExtensions` (outside owned area, 2 lines) so `.test.ts` files that import `./x.ts` (required by `node --test`) typecheck under svelte-check.

## Issues / open items
- Chrome logs "READ-usage buffer was written, then fenced, but written again before being read back" on each readback. Data is correct and readback keeps up (20/20 frames/s). Tried STREAM vs DYNAMIC_READ, orphaning, COPY_READ_BUFFER, single buffer, a task gap between read and write: warning persists in every variant. Not sure of the cause; revisit only if readback shows in `renderMs` on the iGPU.
- Trackers run on the main thread. With all four heavy trackers: track ≈ 17 ms here (dev GPU). A worker is the upgrade path if auto-degrade isn't enough.
- One face tracked (`numFaces: 1`), hands 2, pose 1.
- Blendshape Left/Right are passed through as MediaPipe names them (not swapped); handedness *is* swapped to the person's view.
- GL context loss is not handled.

## Contract notes (no change requested)
- `Frame.output` is never `null` in practice; filters always get an FBO.
- `EngineApi.start` has no width/height/fps, so they live in `createEngine(opts)`.
