# Plan: Phase 4 — UI shell

## Summary
Full cam-toys renderer UI (top bar, preview, category tabs + bubble carousel, Layers drawer with auto-generated param controls, settings modal, first-run tutorial, toasts, ⚡ dialog, error/empty states) built against a mock engine, mock filter registry and mock presets. All engine wiring sits in one file, `src/renderer/src/engine-source.ts`, so Phase 6 swaps mocks for the real engine with one import change.

## User Story
As a non-technical friend, I want to tap a round bubble and see myself as a bear, so that I can be a bear in Discord without learning anything.

## Problem → Solution
Placeholder `App.svelte` that prints "scaffold OK" → polished, fully interactive shell where every PRD screen/state is reachable with mocks.

## Metadata
- **Complexity**: Large
- **Source PRD**: `.claude/PRPs/prds/cam-toys-desktop.prd.md`
- **PRD Phase**: 4 — UI shell
- **Estimated Files**: ~20 (all under `src/renderer/**`)

---

## UX Design

### Before
```
┌──────────────────────────────┐
│          cam-toys            │
│      scaffold OK · fps 30    │
└──────────────────────────────┘
```

### After
```
┌───────────────────────────────────────────────────────────┐
│ cam-toys  [📷 Logitech ▾]   ● LIVE in cam-toys   30 fps ⚙ │
├───────────────────────────────────────────┬───────────────┤
│                                           │ Layers     🎲 │
│        ╭──────── preview ────────╮        │ ┌───────────┐ │
│        │  (canvas, 16:9, r=16)   │        │ │⠿ 🐻 Bear 👁✕│ │
│        │  states overlay here    │        │ │  sliders… │ │
│        ╰─────────────────────────╯        │ └───────────┘ │
│  Featured Face Eyes Hands Body BG Color…  │               │
│  (🐻)(🐶)(🛋)(🔴)(🥺)(📼)(🌃)(🪐)(🖌)(⭕)  │               │
└───────────────────────────────────────────┴───────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Bubble tap | — | adds layer (filter) / replaces stack (preset) | heavy ⇒ confirm dialog once per session |
| Layers drawer | — | drag reorder, 👁 toggle, ✕ remove, params | params generated from `Param` union |
| Top bar | — | camera picker, LIVE pill, fps, gear | pill grey "Camera not installed" when `vcam.available()` false |
| Settings | — | `<dialog>` modal | every change → `camtoys.settings.set(patch)` |
| First run | — | 5-step tutorial w/ spotlight | shown while `tutorialDone` false; replay from settings |

---

## Mandatory Reading
| Priority | File | Why |
|---|---|---|
| P0 | `src/engine/types.ts` | Frozen contract: FilterDef, Param, Layer, Preset, EngineApi, Settings, CamtoysApi |
| P0 | `src/renderer/src/styles/tokens.css` | Palette, radii, font tokens |
| P1 | `src/main/settings.ts` | `DEFAULTS` to mirror in the browser stub |
| P1 | `src/main/settings.test.ts` | Test style: `node:test` + `assert/strict`, `.ts` import extension |
| P1 | `src/renderer/index.html` | CSP is `'self'` only → fonts must be bundled |
| P2 | PRD "Filter Catalog", "UI Design", "User Flow" | catalog, presets, tutorial copy |

## External Documentation
| Topic | Key Takeaway |
|---|---|
| Svelte 5 runes | `$state` in `.svelte.ts` modules for shared stores; export objects (not reassigned primitives) |
| `<dialog>.showModal()` | native focus trap + Esc, `::backdrop` for scrim |
| HTML5 DnD | `draggable`, `dragstart/dragover/drop`; enough for a ≤10-item list |

## Patterns to Mirror
- NAMING: lowercase kebab filter ids (`bear`, `laser-eyes`); PascalCase `.svelte` components; camelCase TS.
- ERROR_HANDLING: `console.warn('[settings] …', err)` prefix style (`src/main/settings.ts:23`); engine errors arrive via `engine.onError` as DOMException names (`NotFoundError`, `NotReadableError`, `NotAllowedError`).
- TEST_STRUCTURE: `import { test } from 'node:test'; import assert from 'node:assert/strict'` with relative `.ts` imports (`src/main/settings.test.ts:1-3`).

---

## Files to Change
| File | Action | Justification |
|---|---|---|
| `src/renderer/src/engine-source.ts` | CREATE | single swap point: `engine`, `filters`, `presets`, `onLoading` |
| `src/renderer/src/mock/engine.ts` | CREATE | EngineApi mock: 2D animated gradient + layer names, fake stats, `?mock=` failure modes |
| `src/renderer/src/mock/filters.ts` | CREATE | FilterDef metadata for the whole PRD catalog (no-op `create`) |
| `src/renderer/src/mock/presets.ts` | CREATE | PRD Featured presets |
| `src/renderer/src/mock/camtoys.ts` | CREATE | `window.camtoys` stub for plain-browser dev (localStorage settings) |
| `src/renderer/src/state/stack.ts` | CREATE | pure stack ops (add/remove/move/toggle/preset/randomize/defaults) |
| `src/renderer/src/state/stack.test.ts` | CREATE | node:test for stack ops |
| `src/renderer/src/state/app.svelte.ts` | CREATE | runes stores: layers, settings, stats, ui, toasts |
| `src/renderer/src/components/*.svelte` | CREATE | TopBar, Preview, Carousel, LayersDrawer, ParamControl, SettingsModal, Tutorial, Toasts, ConfirmHeavy, Tooltip |
| `src/renderer/src/App.svelte` | UPDATE | compose shell |
| `src/renderer/src/main.ts` | UPDATE | install stub when `window.camtoys` missing, load fonts |
| `src/renderer/src/styles/tokens.css` | UPDATE | add shadows, glass, spring easing, @font-face |
| `src/renderer/src/assets/fonts/Inter-latin.woff2` (+ OFL) | CREATE | bundled Inter variable (latin subset) |
| `src/renderer/vite.config.ts` | CREATE | renderer-only vite dev server for browser-pane verification |

## NOT Building
- Real engine/vcam wiring beyond the pump in App (Phase 6), hotkey registration, tray presets, snapshot, mirror toggle, auto-degrade.
- Run-on-startup toggle (needs a main-process setting not in `Settings`; reported as contract gap).
- PRD status edit (PRD is outside `src/renderer/**`; Phase 6 owner updates it).

---

## Step-by-Step Tasks

### Task 1: Mocks + engine-source
- **IMPLEMENT**: `mock/filters.ts` (~41 defs; "Expressions" → `face`, "Motion" → `art` since `Category` has no such members; LUT grades = one `lut` filter with a `grade` select). `mock/presets.ts` (Bear, Puppy, Cozy, Laser Eyes, Anime, VHS Night, Cyberpunk, Space Office, Finger Paint, Clean). `mock/engine.ts`: `start()` rejects with DOMException per `?mock=nocam|busy|denied`; RAF loop draws gradient + layer chips; stats every 500 ms with fps = 31 − 5·heavy − jitter (`?mock=slow` → 18); `onLoading(needs)` fires when new `needs` appear, clears after 1.5 s (`?mock=loading` → 8 s). `engine-source.ts` re-exports.
- **GOTCHA**: mock takes a 2D context; real engine needs WebGL2 on a fresh canvas — fine because Phase 6 replaces the module wholesale.
- **VALIDATE**: typecheck.

### Task 2: State
- **IMPLEMENT**: `state/stack.ts` pure functions; `state/app.svelte.ts` holds `$state` `app` object (settings, layers, stats, cameras, error, loadingNeeds, activePresetId, modals) + actions; persists `lastLayers` debounced.
- **VALIDATE**: `npm test` (stack.test.ts).

### Task 3: Shell components
- **IMPLEMENT**: TopBar, Preview (canvas + state overlays + loading chip), Carousel (tabs, snap scroll, wheel→horizontal, spring select, ⚡ badge, gradient ring, shimmer for loading needs, fixed-position tooltip with hint), LayersDrawer (DnD reorder + Alt+↑/↓, eye, ✕, ParamControl), Randomize.
- **GOTCHA**: carousel `overflow-x:auto` clips tooltips → render tooltip `position:fixed` outside the scroller.

### Task 4: Modals & feedback
- **IMPLEMENT**: SettingsModal (`<dialog>`), Tutorial (5 steps, spotlight via `[data-tour]` rect), Toasts (fps < 24 sustained 3 s, cooldown 30 s), ConfirmHeavy (once per session), vcam-missing popover.

### Task 5: Fonts + dev server
- **IMPLEMENT**: copy Inter variable latin woff2 (OFL-1.1) into `assets/fonts`; `@font-face` in tokens.css; `src/renderer/vite.config.ts` for `npx vite --config src/renderer/vite.config.ts`.

---

## Testing Strategy
| Test | Input | Expected |
|---|---|---|
| addLayer defaults | FilterDef with 4 param kinds | layer.params = each `default` |
| applyPreset | preset with 2 layers | fresh uids, params merged over defaults |
| moveLayer | from 0 → 2 | order updated, out-of-range is no-op |
| randomStack | seeded rng | 2–3 layers, no heavy, no duplicate categories |

## Validation Commands
```bash
npm run typecheck
npm test
npm run build
npx vite --config src/renderer/vite.config.ts   # browser-pane visual check
```

## Manual Validation
- [ ] `?` default: preview animates, LIVE pill grey (browser stub vcam unavailable unless `?mock=vcam`)
- [ ] `?mock=vcam`: pill gradient "LIVE in cam-toys"
- [ ] `?mock=nocam|busy|denied`: matching overlay + Retry
- [ ] `?mock=slow`: fps toast
- [ ] heavy bubble → confirm dialog
- [ ] add face filter → shimmer
- [ ] settings round-trip persists after reload; Replay tutorial works
- [ ] fresh localStorage → tutorial

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 5 real filter ids differ from mock ids | M | presets break | presets keyed by id; Phase 6 aligns in one file |
| `EngineApi.start` has no res/fps args | H | settings can't reach engine | engine reads `camtoys.settings`; UI restarts engine on change. Reported. |
| No model-loading signal in contract | H | shimmer can't be driven | optional `onLoading` exported by engine-source. Reported. |
