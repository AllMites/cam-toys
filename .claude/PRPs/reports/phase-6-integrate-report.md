# Implementation Report: Phase 6 — Integrate

## Summary
The UI now runs on the real engine (via an adapter that rebuilds it when width/height/fps change), the 43-filter registry and real presets. Engine frames feed Softcam, and the window keeps rendering while hidden in the tray (`backgroundThrottling:false`). Added global hotkeys (Ctrl+Alt+→/← cycle presets), a tray Camera on/off toggle + Presets submenu, a 📸 snapshot to Pictures\cam-toys, a paused state, and the engine `onLoading` signal for the model shimmer. The mock engine, filters and presets are deleted; `mock/camtoys.ts` stays for browser-only UI dev.

## Assessment vs Reality
| Metric | Predicted | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 8/10 | Held; nothing blocked |
| Files | 4 new, 7 updated | 4 new, 11 updated, 3 deleted |

## Validation
| Level | Status | Notes |
|---|---|---|
| Typecheck | Pass | 0 errors |
| Unit tests | Pass | 13 pass, 1 skipped (see Issues) |
| Build | Pass | renderer bundle 619 kB + MediaPipe wasm |
| Headless smoke | Pass | `npm run smoke`: 43 filters, 0 failed |
| Real app end-to-end | **Needs user** | restart `npm run dev`: real camera → Bear → Discord; tray hide; hotkeys; snapshot |

## Deviations
- **Mocks**: `mock/engine.ts` deleted too (only its `mockFlags` was still used, so that moved into `mock/camtoys.ts`).
- **Adapter takes `createEngine` as a parameter** (plan: optional 2nd param) so the node test injects a fake without Vite.
- **`vcam.test.ts` skips** instead of failing when another sender holds Softcam's single system-wide slot. A running cam-toys made it fail; that's environment, not a bug.
- **Preset commands bypass the ⚡ confirm** (no window to answer in). Plan said so; noted here because it's a UX choice.
- `setSettings` now also restarts on a **height** change (was missing).

## Known limits
- The tray "Camera on" checkbox tracks its own clicks only. Resuming from the in-app button doesn't untick or re-tick it.
- A paused camera leaves the last frame in Discord (Softcam keeps the last frame).
- Two engines share one canvas GL context after a format change. The old one is stopped but its GL objects aren't freed until reload (small leak per resolution change).
- Auto-degrade not built (`TRACK_W` constant); the slow-fps toast covers v1.

## Tests written
| File | Tests | Covers |
|---|---|---|
| `src/presets/presets.test.ts` | 1 | every preset → real filter id, param keys, select values |
| `src/renderer/src/engine-adapter.test.ts` | 1 | reuse on same format; rebuild keeps layers + subscribers |
