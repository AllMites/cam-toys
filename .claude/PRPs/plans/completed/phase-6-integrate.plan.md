# Plan: Phase 6 — Integrate

## Summary
Swap the UI's mocks for the real engine, the 43-filter registry and real presets. Make output keep flowing while the window is hidden in the tray, and pipe engine frames into the Softcam virtual camera. Add the main-process pieces: global hotkeys, a tray presets submenu, a tray camera toggle and snapshot-to-Pictures. After this phase, `npm run dev` is the real app end-to-end.

## User Story
As a friend on a Discord call, I want to tap Bear in cam-toys and see it in Discord's "cam-toys" camera, even with the window closed to the tray, so I can make people laugh without fiddling.

## Problem → Solution
Four phase branches are merged on `feat/desktop-app` (eb8e297), but the UI runs on `mock/engine.ts` + `mock/filters.ts`, presets reference ids that don't exist, the engine is fixed to one resolution at creation, and a hidden window throttles frames. The fix: one wiring file, an engine adapter, real presets with a test, `backgroundThrottling:false`, plus IPC for hotkeys, tray and snapshot.

## Metadata
- **Complexity**: Medium (≈10 files, mostly wiring)
- **Source PRD**: `.claude/PRPs/prds/cam-toys-desktop.prd.md`
- **PRD Phase**: 6 — Integrate
- **Estimated Files**: 4 new, 7 updated

---

## UX Design

### Before
```
UI shows animated mock gradient · mock filter names · vcam pill grey unless registered
✕ to tray → frames stop (throttled) → Discord freezes
```
### After
```
Real webcam preview with real filters · LIVE pill gradient when Softcam receives frames
✕ to tray → frames keep flowing → Discord keeps the bear
Ctrl+Alt+→/← cycles presets (also from the tray ▸ Presets) · tray "Camera on/off"
📸 button in the top bar → PNG saved to Pictures\cam-toys, toast with the filename
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Hidden window | engine throttled | runs at full fps | `backgroundThrottling:false` |
| Hotkeys | none | Ctrl+Alt+→/← next/prev preset | from `settings.hotkeys`, globalShortcut |
| Tray | Show / Quit | Show · Camera on/off ✓ · Presets ▸ · Quit | |
| Snapshot | none | 📸 in TopBar | saves via main |
| Model loading | mock shimmer | real (engine `onLoading`) | |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/renderer/src/engine-source.ts` | all | THE swap point (Phase 4 contract) |
| P0 | `src/renderer/src/state/app.svelte.ts` | all | Boot, vcam pump (`engine.onFrame` → `vcam.send` when w/h match settings), `startCamera`, `setSettings` restarts on camera/width/fps change, `tapPreset` |
| P0 | `src/engine/engine.ts` | 1-60 | `createEngine(opts: EngineOptions)`; size/fps fixed per instance; `onFrame` buffer is reused |
| P0 | `src/engine/trackers.ts` | 55-85 | `Trackers.want/start`; `loading` Set to surface |
| P1 | `src/preload/vcam.ts` | all | koffi bridge; `available()` = DLL loaded + CLSID registered |
| P1 | `src/main/index.ts`, `src/main/tray.ts` | all | Window opts, IPC style (`domain:verb`), tray module-level ref |
| P1 | `src/renderer/src/mock/presets.ts` | all | Preset list to port (ids need fixing) |
| P1 | `src/filters/registry.test.ts` | all | Static, no-WebGL test style to mirror for presets |
| P2 | `.claude/PRPs/reports/phase-3-engine-report.md` | Deviations | MediaStreamTrackProcessor; hidden window needs `backgroundThrottling:false` |
| P2 | `.claude/PRPs/reports/phase-4-ui-shell-report.md` | Contract gaps | onLoading, start() has no format, no run-on-startup |

## External Documentation
| Topic | Source | Key Takeaway |
|---|---|---|
| globalShortcut | Electron docs (`globalShortcut.register(accel, fn)`) | Register after `ready`; `unregisterAll()` on `will-quit`; returns false if taken, so toast it, don't crash |
| backgroundThrottling | `webPreferences.backgroundThrottling` | `false` keeps timers/rAF/media pipelines running while hidden |
| Pictures path | `app.getPath('pictures')` | Writable without admin |

No other external research needed.

---

## Patterns to Mirror

### IPC (main)
```ts
// SOURCE: src/main/index.ts (settings handlers)
ipcMain.handle('settings:get', () => settings)
ipcMain.on('app:quit', () => app.quit())
```
New channels: `snapshot:save` (handle, arg `Uint8Array` PNG → returns saved path), `presets:list` (renderer → main, `send` with `{id,name,icon}[]` for the tray), `preset:apply` (main → renderer, `webContents.send('preset:apply', id | 'next' | 'prev')`), `camera:toggle` (main → renderer).

### Preload exposure
```ts
// SOURCE: src/preload/index.ts
const api: CamtoysApi = { settings: { get: () => ipcRenderer.invoke('settings:get'), ... }, vcam, quit: ... }
contextBridge.exposeInMainWorld('camtoys', api)
```
Contract change (allowed in Phase 6, the integration owner): extend `CamtoysApi` in `src/engine/types.ts` **additively**:
```ts
saveSnapshot(png: Uint8Array): Promise<string>          // returns file path
setPresets(list: { id: string; name: string; icon: string }[]): void
onCommand(cb: (cmd: { type: 'preset'; id: string } | { type: 'camera' }) => void): () => void
```
Update `src/renderer/src/mock/camtoys.ts` with no-op versions so the browser UI dev server keeps working.

### Error/toast style
```ts
// SOURCE: src/renderer/src/state/app.svelte.ts onStats
toast('🐢', `Running slow (${s.fps} fps). Try turning off ⚡ filters.`, 7000)
```
### Logging
`console.warn('[module] ...')`, as in `src/main/settings.ts` and `src/preload/vcam.ts`.
### Tests
Static `node:test` like `src/filters/registry.test.ts` (read source text, no WebGL, no Vite).

---

## Files to Change
| File | Action | Justification |
|---|---|---|
| `src/presets/presets.ts` | CREATE | Real presets (pure data, importable by main + renderer) |
| `src/presets/presets.test.ts` | CREATE | Every preset filterId exists; select values valid |
| `src/renderer/src/engine-adapter.ts` | CREATE | EngineApi wrapper that recreates `createEngine` when the format changes; keeps subscriptions |
| `src/renderer/src/engine-source.ts` | UPDATE | Point at adapter, `@filters/index`, `src/presets/presets` |
| `src/engine/engine.ts` + `src/engine/trackers.ts` | UPDATE (small) | `EngineOptions.onLoading?(needs)`; Trackers calls it when `loading` changes |
| `src/engine/types.ts` | UPDATE (additive) | `CamtoysApi` additions above |
| `src/preload/index.ts` | UPDATE | Expose the new API methods |
| `src/main/index.ts` | UPDATE | `backgroundThrottling:false`, snapshot/presets IPC, hotkeys |
| `src/main/tray.ts` | UPDATE | Camera toggle + Presets submenu, `setPresets()` rebuild |
| `src/renderer/src/state/app.svelte.ts` | UPDATE | `onCommand` handling, `setPresets` on boot, `snapshot()`, camera pause |
| `src/renderer/src/components/TopBar.svelte` | UPDATE | 📸 button |
| `src/renderer/src/mock/camtoys.ts` | UPDATE | No-op new API |
| `src/renderer/src/mock/filters.ts`, `mock/presets.ts`, `mock/engine.ts` | KEEP or DELETE | Delete `mock/filters.ts` + `mock/presets.ts` (stale ids). Keep `mock/engine.ts` only if `vite.config.ts` browser dev uses it; otherwise delete |

## NOT Building
- Auto-degrade by lowering tracker resolution (`TRACK_W` is a ponytail constant). The existing slow-fps toast covers it for v1.
- Run-on-startup (no Settings field; PRD says default off).
- GIF capture, "Off" placeholder frame (Could).
- Packaging/CI/README (Phase 7).

---

## Step-by-Step Tasks

### Task 1: PRD housekeeping (DONE during planning)
- **ACTION**: Mark PRD phases 2, 4, 5 `complete` with links (`../plans/phase-2-vcam.plan.md` → move to `completed/`, `../reports/phase-4-ui-shell-report.md`; Phase 5 has no report file, so link branch commit `d89365e`). Phase 6 `in-progress` → this plan.
- **VALIDATE**: The table reads correctly.

### Task 2: Real presets + test
- **IMPLEMENT** `src/presets/presets.ts`: copy `mock/presets.ts` with id fixes: `bg-blur`→`blur`, `film-grain`→`grain-vignette`, `bg-replace`→`replace`. `lut` grades `Warm`/`Pastel`/`Cyberpunk` and `replace` scene `Space` are valid (checked: `GRADES` in `src/filters/color/lut.ts:3`, `SCENES` in `src/filters/background/replace.ts:4`).
- **IMPLEMENT** `src/presets/presets.test.ts`: import `presets` (pure TS, no Vite features). For each layer, find `src/filters/*/<filterId>.ts` on disk and assert it exists. For each param key, assert the filter source contains `<key>:`. For select values, assert the string appears in that file. Add `src/presets/**` to both tsconfigs' `include`.
- **GOTCHA**: `presets.ts` must not import anything Vite-only (main imports it too). Type-only import from `../engine/types`.
- **VALIDATE**: `npm test` passes; break one id locally and confirm the test fails.

### Task 3: Engine loading signal
- **IMPLEMENT**: `EngineOptions.onLoading?: (needs: Need[]) => void`. In `Trackers`, accept an `onLoading` callback (constructor 2nd arg) and call it with `[...this.loading]` after every add/delete in `start()`. Map `Kind` → `Need` 1:1 (same strings).
- **VALIDATE**: typecheck.

### Task 4: Engine adapter
- **IMPLEMENT** `src/renderer/src/engine-adapter.ts`:
```ts
// Wraps createEngine so the UI can keep one EngineApi while width/height/fps change:
// start() re-reads settings and rebuilds the engine when the format differs.
export function createAdaptiveEngine(getFormat: () => Promise<{ width: number; height: number; fps: number }>): EngineApi & { onLoading(cb): () => void }
```
  Keep `Set`s of stats/frame/error/loading callbacks and fan them out from the current inner engine. Store the last `layers` and reapply them on rebuild. `start`: if format changed → `inner?.stop()`, `inner = createEngine({...fmt, onLoading: fan})`, re-subscribe, then `inner.setLayers(last)`. `listCameras`/`snapshot`/`stop` delegate (`listCameras` may need an engine, so create lazily with the current format).
- **GOTCHA**: `onFrame` gives a reused buffer, and `vcam.send` is synchronous FFI, so it's fine. Don't store it.
- **VALIDATE**: Add a `node:test` with a fake `createEngine` injected (2nd param, default real) that checks a rebuild on format change re-applies layers and keeps callbacks.

### Task 5: Wire engine-source
- **IMPLEMENT**:
```ts
import { filters } from '@filters/index'
import { presets } from '../../presets/presets'
import { createAdaptiveEngine } from './engine-adapter'
export { filters, presets }
export const engine = createAdaptiveEngine(async () => { const s = await window.camtoys.settings.get(); return { width: s.width, height: s.height, fps: s.fps } })
export const onLoading = engine.onLoading
```
  Delete `mock/filters.ts` and `mock/presets.ts`. Check whether `mock/engine.ts` is still imported (browser dev `?mock` flags in `mock/camtoys.ts` import `mockFlags` from it). Keep it if so, otherwise delete.
- **GOTCHA**: `app.svelte.ts setSettings` restarts on `cameraId/width/fps` change but **not height**. Add `prev.height !== s.height`.
- **VALIDATE**: `npm run typecheck`, `npm run build`.

### Task 6: Keep running in the tray
- **IMPLEMENT**: `webPreferences.backgroundThrottling: false` in `src/main/index.ts`.
- **VALIDATE**: In dev, hide the window to the tray and confirm the vcam keeps receiving frames. Proxy: `stats.fps` logged from the renderer stays ≥ 25 while hidden (temporary `console.log`, removed after).

### Task 7: Contract additions + preload + mock
- **IMPLEMENT**: Add the `CamtoysApi` methods (Patterns section) to `types.ts`. Preload: `saveSnapshot: (png) => ipcRenderer.invoke('snapshot:save', png)`, `setPresets: (l) => ipcRenderer.send('presets:list', l)`, `onCommand: (cb) => { const h = (_e, c) => cb(c); ipcRenderer.on('command', h); return () => ipcRenderer.off('command', h) }`. Mock: no-ops (`saveSnapshot` → download via `<a download>` is fine, or resolve `'mock.png'`).
- **VALIDATE**: typecheck.

### Task 8: Main: snapshot, hotkeys, tray
- **IMPLEMENT** in `src/main/index.ts`:
  - `ipcMain.handle('snapshot:save', (_e, png: unknown) => { if (!(png instanceof Uint8Array)) throw new Error('bad png'); const dir = join(app.getPath('pictures'), 'cam-toys'); mkdirSync(dir, {recursive:true}); const f = join(dir, \`cam-toys-${new Date().toISOString().replace(/[:.]/g,'-')}.png\`); writeFileSync(f, png); return f })`. That's a trust-boundary type check.
  - `const send = (c) => win?.webContents.send('command', c)`.
  - Hotkeys: `globalShortcut.register(settings.hotkeys.next, () => send({type:'preset', id:'next'}))` and the same for prev. Re-register in `settings:set` when hotkeys change. `app.on('will-quit', () => globalShortcut.unregisterAll())`. If register returns false → `console.warn('[hotkeys] taken', accel)`.
  - `ipcMain.on('presets:list', (_e, list) => setTrayPresets(Array.isArray(list) ? list : []))`.
- **IMPLEMENT** `src/main/tray.ts`: `createTray(show, send)`; module state `presets` + `cameraOn = true`; `rebuild()` builds the menu `[Show, sep, {label:'Camera on', type:'checkbox', checked: cameraOn, click: () => { cameraOn = !cameraOn; send({type:'camera'}); rebuild() }}, {label:'Presets', submenu: presets.map(p => ({ label: \`${p.icon} ${p.name}\`, click: () => send({type:'preset', id:p.id}) }))}, sep, Quit]`. Export `setTrayPresets(list)` → rebuild.
- **VALIDATE**: Dev: the tray menu shows presets, and clicking one changes the stack.

### Task 9: Renderer: commands, snapshot, camera toggle
- **IMPLEMENT** in `app.svelte.ts` `init()`:
  - `api().setPresets(presets.map(({id,name,icon}) => ({id,name,icon})))`.
  - `api().onCommand((c) => c.type === 'camera' ? toggleCamera() : applyPresetCommand(c.id))`. `applyPresetCommand`: `'next'|'prev'` cycles through `presets`, starting from `app.activePreset` (or index -1). Otherwise find by id → `tapPreset(p)` **without** the heavy confirm (no window to answer in), so call `stack.applyPreset` directly and toast the name.
  - `toggleCamera()`: if running → `engine.stop()`, `app.status = 'paused'` (extend the union; Preview shows "Camera paused · tap to resume", or reuse the error card with copy). Else `startCamera()`.
  - `export async function snapshot()`: `const b = await engine.snapshot(); const path = await api().saveSnapshot(new Uint8Array(await b.arrayBuffer())); toast('📸', 'Saved to Pictures\\cam-toys', 3000)`; on catch, `toast('⚠️', 'Snapshot failed')`.
- **IMPLEMENT** TopBar: a 📸 icon button (mirror the existing gear button markup/classes) calling `snapshot()`, disabled unless `app.status === 'running'`.
- **GOTCHA**: The vcam keeps the last frame when the camera is paused (Softcam behaviour), and that's acceptable. Note it in the report.
- **VALIDATE**: typecheck; the stack.test still passes.

### Task 10: End-to-end validation + report + commit
- Run every command below. Run the headless smoke (`npm run smoke`) if it still applies to the gallery. Ask the user for the real-camera check (no desktop screenshots; the user is often on video calls).
- Write `.claude/PRPs/reports/phase-6-integrate-report.md`, mark PRD phase 6 complete, archive this plan, and commit `feat: wire real engine, filters, presets, vcam, hotkeys, tray, snapshot`.

---

## Testing Strategy
| Test | Input | Expected | Edge? |
|---|---|---|---|
| presets valid | `presets` | every filterId file exists, params/select values exist | ✓ |
| adapter rebuild | format 720p → 1080p | inner recreated, layers reapplied, callbacks still fire | ✓ |
| adapter same format | start twice | no rebuild | |
| existing | settings, stack, registry, convert, vcam | still pass | |

### Edge Cases
- [ ] Hotkey already taken by another app → warn, app still runs
- [ ] Preset command while the camera is errored → stack updates, applies when the camera starts
- [ ] Snapshot before the first frame → toast failure, no crash
- [ ] vcam not registered → pill grey, `onFrame` early-returns (already in app.svelte.ts)
- [ ] Settings change 720p → 1080p → engine rebuilt, vcam restarted at the new size (`restartVcam` after start)

---

## Validation Commands
```bash
npm run typecheck
```
EXPECT: 0 errors
```bash
npm test
```
EXPECT: all pass (≥ 14)
```bash
npm run build
```
EXPECT: success
```bash
npm run dev
```
EXPECT: real camera + filters; tray presets; hotkeys; 📸 saves

### Manual Validation (user)
- [ ] Register Softcam (`docs/VCAM.md`), open Discord → camera "cam-toys" → tap Bear → visible in Discord
- [ ] ✕ to tray → Discord keeps updating (not frozen)
- [ ] Ctrl+Alt+→ cycles presets while Discord is focused
- [ ] 📸 creates a PNG in Pictures\cam-toys
- [ ] Settings 1080p → preview + Discord switch resolution

## Acceptance Criteria
- [ ] No `mock/filters` / `mock/presets` imports remain; the UI runs on the real registry (43 filters)
- [ ] Output continues while hidden
- [ ] Hotkeys, tray presets, tray camera toggle, snapshot all work
- [ ] typecheck/test/build green

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Main-thread trackers + hidden window still throttled by Chromium occlusion | M | H | `backgroundThrottling:false`; if fps still drops when hidden, add `app.commandLine.appendSwitch('disable-renderer-backgrounding')` + `'disable-background-timer-throttling'` before ready |
| koffi `send` cost at 1080p60 | L | M | Already synchronous; measure `renderMs`; default stays 720p30 |
| Mock UI names ≠ real filter names/hints | M | L | Real registry replaces them wholesale |

## Notes
- Phase 6 is the single writer for cross-cutting files, so editing main, preload, renderer, engine and types is allowed here.
- Confidence: **8/10**. The real-camera and Discord checks need the user.
