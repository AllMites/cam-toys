# Implementation Report: Phase 4 — UI shell

## Summary
Full renderer UI against mocks: top bar (camera picker, LIVE pill, fps, layers toggle, gear), 16:9 preview with camera states, category tabs + round bubble carousel (⚡ badge, gradient ring, spring, hint tooltip, shimmer), Layers drawer (grip drag-reorder + Alt+↑/↓, eye, ✕, params generated from `Param`), Settings `<dialog>`, 5-step spotlight tutorial, toasts, ⚡ confirm dialog. Inter variable (latin, OFL) bundled.

## Validation
| Level | Status | Notes |
|---|---|---|
| Typecheck | Pass | 0 errors / 0 warnings |
| Tests | Pass | 8 (6 new in `src/renderer/src/state/stack.test.ts`) |
| Build | Pass | renderer 247 kB JS, 25 kB CSS, 48 kB font |
| Browser pane | Pass | every state below exercised at 1280×820 and 960×640 |

## States reachable with mocks (renderer dev server)
`npx vite --config src/renderer/vite.config.ts` → http://localhost:5211, flags via `?mock=a,b`:
- default: running, pill grey "Camera not installed" (click → help popover)
- `vcam`: pill gradient "LIVE in cam-toys"; `slow`: fps 18 amber + 🐢 toast after 3 s
- `nocam` / `busy` / `denied`: matching error card + Try again
- `loading`: 8 s tracker load → preview chip + bubble/card shimmer
- heavy (Ghost trails, Neon outline, Cyberpunk preset): ⚡ confirm once per session
- fresh localStorage → tutorial; Settings › Replay tutorial

## Deviations
- Tap on an already-active filter bubble removes it (Snapchat-style toggle) instead of adding a duplicate.
- Layers list shows newest on top; `app.layers` stays in render order.
- Mock engine reads res from `camtoys.settings` in `start()` (contract `start()` has no size args).
- PRD status not edited (outside `src/renderer/**`).

## Contract gaps (for Phase 6 / types.ts owner)
1. No model-loading signal in `EngineApi` → `engine-source.ts` exports an optional `onLoading(cb(needs[]))`.
2. `EngineApi.start(canvas, deviceId)` has no width/height/fps → engine must read `camtoys.settings`; UI restarts the engine when they change.
3. "Run on startup" (PRD Phase 4 scope) has no `Settings` field → not built.
4. `Category` lacks PRD "Expressions"/"Motion" → mapped to `face`/`art`.

## Phase 6 swap
Edit only `src/renderer/src/engine-source.ts`: point `engine`, `filters`, `presets`, `onLoading` at the real modules. Vcam pump already lives in `state/app.svelte.ts` (`engine.onFrame` → `vcam.send` when frame size matches settings).
