# Plan: Phase 1 — Scaffold

## Summary
Replace the vanilla browser toys with an empty but buildable Electron + Svelte 5 + Vite + TypeScript app. It gets a dark window, a tray icon with close-to-tray, a single-instance lock, camera permission, settings persisted as JSON over IPC, and an NSIS installer config. It also **freezes the shared contract** (`src/engine/types.ts` + folder layout) so Phases 2, 3 and 4 can run in parallel without touching each other's files.

## User Story
As the agents building Phases 2–5, I want a working app skeleton with a frozen type contract and owned folders, so that we can build vcam, engine, UI and filters in parallel without merge conflicts.

## Problem → Solution
The repo holds 5 standalone HTML toys, with no build, no app and no types. The replacement is an `electron-vite` project that runs with `npm run dev` and builds with `npm run build:win` into `dist/cam-toys-Setup-x.y.z.exe`.

## Metadata
- **Complexity**: Medium-Large (greenfield, ~20 files, mostly config)
- **Source PRD**: `.claude/PRPs/prds/cam-toys-desktop.prd.md`
- **PRD Phase**: 1 — Scaffold
- **Estimated Files**: ~20 created, 7 deleted

---

## UX Design

### Before
```
browser → localhost:8000 → index.html → pick a toy page
```

### After
```
┌──────────────────────────────────────────────┐
│ cam-toys                              ─ □ ✕  │  ✕ hides to tray
│                                              │
│            (dark #0F0F12 window)             │
│        "cam-toys" wordmark, gradient         │
│        purple→pink, "scaffold OK" line       │
│                                              │
└──────────────────────────────────────────────┘
Tray icon ▸ Show cam-toys · Quit
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Launch | python http.server | Start menu / tray app | single instance |
| Close ✕ | tab closes | window hides to tray | Quit only from tray menu |
| 2nd launch | n/a | focuses existing window | `second-instance` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/cam-toys-desktop.prd.md` | Technical Approach + Phases | Contract, ownership, design tokens |
| P2 | `cam.js` | all | Only reusable idea: wait for `videoWidth > 0` before trusting frames (Phase 3 uses it). Deleted afterwards. |

Nothing else in the repo carries over. The old toys are deleted by user decision.

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| electron-vite layout | Context7 `/alex8088/electron-vite-docs` | Convention: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`. Zero-config entry discovery. `package.json` `"main": "./out/main/index.js"` |
| electron-vite scaffolding | `npm create @quick-start/electron@latest` | Has a `svelte-ts` template. Use it as the source of truth for config shape and versions |
| NSIS custom hooks | Context7 `/electron-userland/electron-builder` (nsis.md) | `build/installer.nsh` auto-included. Macros `customInstall`, `customUnInstall`. `nsis.perMachine: true`, `oneClick: false` |
| extraResources | electron-builder contents.md | Files outside asar; runtime path `process.resourcesPath` (Phase 2 puts `softcam.dll` here, Phase 3 puts models) |
| Tray / close-to-tray | Context7 `/electron/electron` tray.md | Keep `tray` in a module-level var (GC). Empty `window-all-closed` listener keeps the app alive |
| Single instance | electron app.md | `app.requestSingleInstanceLock()`; on `second-instance` restore + focus |
| Camera permission | electron session.md | `session.defaultSession.setPermissionRequestHandler` → allow `'media'` only |

```
KEY_INSIGHT: electron-vite finds entries by convention; don't write rollupOptions.input.
APPLIES_TO: electron.vite.config.ts
GOTCHA: The scaffolder refuses non-empty dirs → scaffold into the scratchpad, copy files in.

KEY_INSIGHT: Node 24 runs .ts directly (type stripping) → `node --test` works on pure TS modules with no test framework.
APPLIES_TO: settings test
GOTCHA: Only erasable TS syntax (no enums, no namespaces, no param properties). Import with the explicit `.ts` extension in the test file.

KEY_INSIGHT: electron-builder converts a 256×256+ PNG into .ico for Windows.
APPLIES_TO: build/icon.png
GOTCHA: The tray icon needs its own small PNG at runtime (resources/tray.png, 32×32) since nativeImage can't load SVG.
```

---

## Patterns to Mirror

There are no existing TS/Electron patterns, because this phase **sets** them. Conventions that later phases must follow:

### NAMING_CONVENTION
- Files: `kebab-case.ts`. Svelte components: `PascalCase.svelte`. Filters: `src/filters/<category>/<id>.ts`, where `id` is kebab-case and equals the filename.
- Exports: named exports only, except a filter file, which `export default` its `FilterDef`.
- IPC channels: `domain:verb`, e.g. `settings:get`, `settings:set`, `app:quit`.

### COMMENT STYLE (from existing repo, keep it)
```js
// SOURCE: cam.js:3-4
// Ask for the webcam, attach it to a hidden <video>, resolve once frames are flowing.
export async function startCamera() {
```
One-line "what/why" comment above non-obvious functions. No JSDoc walls.

### ERROR_HANDLING
```js
// SOURCE: cam.js:10-12 — wrap platform errors with a readable prefix, rethrow
} catch (err) {
  throw new Error('Camera unavailable: ' + err.name);
}
```
Main process: never crash on bad settings. Fall back to defaults and `console.warn`.

### LOGGING_PATTERN
`console.log/warn/error` with a `[module]` prefix, e.g. `console.warn('[settings] corrupt file, using defaults', err)`. No logging library.

### TEST_STRUCTURE
`node:test` + `node:assert/strict`, with files `*.test.ts` next to the module, run by `npm test` → `node --test "src/**/*.test.ts"`. Only pure modules (no `electron` import) get tests.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `index.html`, `ascii.html`, `motion.html`, `shader.html`, `hands.html`, `pose.html`, `cam.js` | DELETE | User: overhaul, kill old toys |
| `docs/superpowers/**` | KEEP | History of old design; harmless |
| `README.md` | REWRITE | Placeholder: name, one-liner, `npm i && npm run dev`, "WIP" |
| `LICENSE` | CREATE | MIT, `Copyright (c) 2026 AllMites` |
| `.gitignore` | CREATE | `node_modules/ out/ dist/ native/build/ *.log` |
| `package.json` | CREATE | Scripts and deps below |
| `electron.vite.config.ts` | CREATE | svelte plugin on renderer, `@engine`/`@filters` aliases |
| `electron-builder.yml` | CREATE | NSIS config below |
| `build/installer.nsh` | CREATE | Empty `customInstall`/`customUnInstall` macros with `; Phase 2: regsvr32 softcam.dll` comments |
| `build/icon.png` | CREATE | 512×512 generated |
| `resources/tray.png` | CREATE | 32×32 generated |
| `scripts/make-icons.mjs` | CREATE | Generates both PNGs with `node:zlib` (no deps) |
| `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` | CREATE | From the scaffolder; add path aliases |
| `src/main/index.ts` | CREATE | Window, tray, lifecycle, permission, IPC wiring |
| `src/main/tray.ts` | CREATE | Tray + menu builder |
| `src/main/settings.ts` | CREATE | Pure load/merge/save (no electron import; path passed in) |
| `src/main/settings.test.ts` | CREATE | The one runnable check |
| `src/preload/index.ts` | CREATE | `contextBridge.exposeInMainWorld('camtoys', { settings, vcam: stub })` |
| `src/preload/vcam.ts` | CREATE | Stub implementing `VcamApi` (no-ops, `available:false`). **Owned by Phase 2** |
| `src/renderer/index.html` | CREATE | CSP meta, root div |
| `src/renderer/src/main.ts` | CREATE | `mount(App, { target })` (Svelte 5 API) |
| `src/renderer/src/App.svelte` | CREATE | Placeholder screen (wordmark + "scaffold OK" + settings round-trip proof) |
| `src/renderer/src/styles/tokens.css` | CREATE | Design tokens from PRD (Phase 4 extends, never renames) |
| `src/renderer/src/env.d.ts` | CREATE | `window.camtoys: CamtoysApi` typing |
| `src/engine/types.ts` | CREATE | **Frozen contract** (full text below) |
| `src/engine/.gitkeep`, `src/filters/index.ts` | CREATE | `export const filters: FilterDef[] = []` |

## NOT Building
- Any real UI beyond the placeholder (Phase 4)
- Camera capture, GL, MediaPipe (Phase 3)
- Softcam, koffi, regsvr32 logic (Phase 2), apart from stub + empty macros
- GitHub Actions (Phase 7)
- Hotkeys, tray presets submenu (Phase 6)
- Lint config. `svelte-check` + `tsc` typecheck is enough (YAGNI)

---

## Step-by-Step Tasks

### Task 1: Clean repo + scaffold
- **ACTION**: Branch `feat/desktop-app` off `master`. `git rm` the 7 old files. Scaffold `npm create @quick-start/electron@latest camtoys -- --template svelte-ts` in the **scratchpad**, then copy into the repo: `package.json`, `electron.vite.config.ts`, `electron-builder.yml`, `tsconfig*.json`, `src/`, `build/`, `resources/`. Skip the template's README, `.vscode`, `.github` and dev-app-update.yml.
- **IMPLEMENT**: In `package.json` set `"name": "cam-toys"`, `"productName": "cam-toys"`, `"version": "0.1.0"`, `"description": "Fun webcam filters + virtual camera"`, `"author": "AllMites"`, `"license": "MIT"`. Remove `electron-updater` and any auto-update code (PRD: no auto-update). Keep `@electron-toolkit/utils` + `@electron-toolkit/preload` only if the template uses them. Otherwise drop them.
- **GOTCHA**: Template versions are the version pins. Don't hand-edit versions. Confirm Svelte is 5 (`mount()` API, runes). If the template ships Svelte 4, bump `svelte` + `@sveltejs/vite-plugin-svelte` to latest 5 and fix `main.ts`.
- **VALIDATE**: `npm install` succeeds. `npm run dev` opens the template window.

### Task 2: Scripts
- **IMPLEMENT** in `package.json` `scripts`:
```json
"dev": "electron-vite dev",
"build": "electron-vite build",
"build:win": "npm run build && electron-builder --win --x64",
"typecheck": "tsc --noEmit -p tsconfig.node.json && svelte-check --tsconfig ./tsconfig.web.json",
"test": "node --test \"src/**/*.test.ts\"",
"icons": "node scripts/make-icons.mjs"
```
- **GOTCHA**: The `node --test` glob needs quotes on Windows. Node ≥ 22.18 is required for TS stripping (local is v24.15.0). Add `"engines": { "node": ">=22.18" }`.
- **VALIDATE**: `npm test` runs (0 tests is OK until Task 6).

### Task 3: Aliases + config
- **IMPLEMENT** `electron.vite.config.ts`:
```ts
import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const alias = { '@engine': resolve('src/engine'), '@filters': resolve('src/filters') }

export default defineConfig({
  main: { resolve: { alias } },
  preload: { resolve: { alias } },
  renderer: { resolve: { alias }, plugins: [svelte()] }
})
```
  Mirror in `tsconfig.web.json` and `tsconfig.node.json` `compilerOptions.paths`: `"@engine/*": ["src/engine/*"]`, `"@filters/*": ["src/filters/*"]`, and make sure `include` covers `src/engine/**` + `src/filters/**` in web and `src/engine/types.ts` in node (the preload imports types).
- **GOTCHA**: If the template's config uses `externalizeDepsPlugin()`, keep it for main/preload (Phase 2 needs `koffi` externalized).
- **VALIDATE**: `npm run typecheck` passes.

### Task 4: Frozen contract `src/engine/types.ts`
- **IMPLEMENT** exactly this (Phases 2–6 code against it; changes need a note in the phase report):
```ts
// Shared contract between engine, UI, filters and preload. Frozen after Phase 1.

export type Category =
  | 'featured' | 'face' | 'eyes' | 'hands' | 'body' | 'background' | 'color' | 'retro' | 'art';
export type Need = 'face' | 'hands' | 'gestures' | 'pose' | 'segment';
export type Cost = 'light' | 'medium' | 'heavy';

export type Param =
  | { type: 'range'; label: string; min: number; max: number; step?: number; default: number }
  | { type: 'color'; label: string; default: string }
  | { type: 'select'; label: string; options: string[]; default: string }
  | { type: 'toggle'; label: string; default: boolean };
export type ParamValues = Record<string, number | string | boolean>;

// Landmarks are normalised 0..1 in UN-mirrored frame space (x right, y down).
export interface Pt { x: number; y: number; z: number }
export interface FaceResult { faces: Pt[][]; blendshapes: Record<string, number>[] } // 478 pts/face
export interface HandsResult { hands: Pt[][]; handedness: ('Left' | 'Right')[]; gestures: string[] } // 21 pts/hand
export interface PoseResult { poses: Pt[][] } // 33 pts/pose

export interface Frame {
  input: WebGLTexture;
  output: WebGLFramebuffer | null; // null = default framebuffer
  width: number; height: number;
  time: number; dt: number;         // seconds
  face?: FaceResult; hands?: HandsResult; pose?: PoseResult;
  mask?: WebGLTexture;              // person mask, R channel 0..1
}

export interface FilterInstance {
  render(f: Frame, params: ParamValues): void;
  dispose(): void;
}

export interface FilterDef {
  id: string; name: string; category: Exclude<Category, 'featured'>;
  icon: string;                      // emoji
  cost: Cost; needs: Need[];
  hint: string;                      // one line for tooltip/tutorial
  params: Record<string, Param>;
  create(gl: WebGL2RenderingContext): FilterInstance;
}

export interface Layer { uid: string; filterId: string; enabled: boolean; params: ParamValues }
export interface Preset { id: string; name: string; icon: string; layers: Omit<Layer, 'uid'>[] }

export interface EngineStats { fps: number; trackMs: number; renderMs: number }
export interface EngineApi {
  start(canvas: HTMLCanvasElement, deviceId?: string): Promise<void>;
  stop(): void;
  setLayers(layers: Layer[]): void;
  listCameras(): Promise<MediaDeviceInfo[]>;
  snapshot(): Promise<Blob>;
  onStats(cb: (s: EngineStats) => void): () => void;
  onFrame(cb: (bgr: Uint8Array, w: number, h: number) => void): () => void; // for vcam
  onError(cb: (e: Error) => void): () => void;
}

export interface VcamApi {
  available(): boolean;              // DLL loaded + registered
  start(width: number, height: number, fps: number): boolean;
  send(bgr: Uint8Array): void;       // width*height*3 bytes, top-down rows
  stop(): void;
}

export interface Settings {
  cameraId: string | null;
  width: number; height: number; fps: number;     // default 1280x720@30
  lastLayers: Omit<Layer, 'uid'>[];
  tutorialDone: boolean;
  closeToTray: boolean;                           // default true
  hotkeys: { next: string; prev: string };        // 'Control+Alt+Right' / 'Control+Alt+Left'
}

export interface CamtoysApi {
  settings: { get(): Promise<Settings>; set(patch: Partial<Settings>): Promise<Settings> };
  vcam: VcamApi;
  quit(): void;
}
```
- **GOTCHA**: Types only, no runtime code. The file must stay importable from both node and web tsconfigs (no DOM-only *values*, DOM *types* are OK in web). If the node tsconfig lacks the `DOM` lib, add `"lib": ["ES2023", "DOM"]` to tsconfig.node.json so the preload can import `CamtoysApi`.
- **VALIDATE**: typecheck passes.

### Task 5: Settings module (pure)
- **IMPLEMENT** `src/main/settings.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Settings } from '../engine/types.ts'

export const DEFAULTS: Settings = {
  cameraId: null, width: 1280, height: 720, fps: 30,
  lastLayers: [], tutorialDone: false, closeToTray: true,
  hotkeys: { next: 'Control+Alt+Right', prev: 'Control+Alt+Left' }
}

// Shallow-merge onto defaults so new keys appear and unknown junk is ignored.
export function merge(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULTS)
  const out = structuredClone(DEFAULTS) as Record<string, unknown>
  for (const k of Object.keys(DEFAULTS)) if (k in raw) out[k] = (raw as Record<string, unknown>)[k]
  return out as Settings
}

export function load(file: string): Settings {
  try { return merge(JSON.parse(readFileSync(file, 'utf8'))) }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[settings] unreadable, using defaults', err)
    return structuredClone(DEFAULTS)
  }
}

export function save(file: string, s: Settings): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(s, null, 2))
}
```
- **GOTCHA**: `.ts` extension in the import works under Node type stripping, but **electron-vite's bundler** also needs it to resolve. Set `"allowImportingTsExtensions": true` + `"noEmit": true` in both tsconfigs (Vite handles the extension fine). If that conflicts, use `import type` (erased, so no runtime resolution), which is already the case here, and drop the extension. Prefer `import type ... from '../engine/types'` without extension and confirm `node --test` still runs (type-only imports are erased, so it will).
- **VALIDATE**: Task 6 test.

### Task 6: The one test
- **IMPLEMENT** `src/main/settings.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { merge, DEFAULTS } from './settings.ts'

test('merge fills defaults and drops unknown keys', () => {
  const s = merge({ fps: 60, bogus: 1 })
  assert.equal(s.fps, 60)
  assert.equal(s.width, DEFAULTS.width)
  assert.ok(!('bogus' in s))
})
test('merge survives garbage', () => {
  assert.deepEqual(merge(null), DEFAULTS)
  assert.deepEqual(merge('nope'), DEFAULTS)
})
```
- **VALIDATE**: `npm test` gives 2 passing.

### Task 7: Main process
- **IMPLEMENT** `src/main/index.ts` (keep the template's `join(__dirname, '../preload/index.js')` preload path and dev-URL/`loadFile` logic):
  - `if (!app.requestSingleInstanceLock()) app.quit()`; on `second-instance` call `showWindow()`.
  - `const settingsFile = join(app.getPath('userData'), 'settings.json')`; `let settings = load(settingsFile)`.
  - `BrowserWindow({ width: 1280, height: 820, minWidth: 960, minHeight: 640, backgroundColor: '#0F0F12', show: false, autoHideMenuBar: true, title: 'cam-toys', webPreferences: { preload, contextIsolation: true, sandbox: false, nodeIntegration: false } })`; `ready-to-show` → `show()`.
  - Close-to-tray: module `let quitting = false`; `app.on('before-quit', () => quitting = true)`; `win.on('close', e => { if (!quitting && settings.closeToTray) { e.preventDefault(); win.hide() } })`.
  - `app.on('window-all-closed', () => {})`. The app quits only via the tray or `app:quit`.
  - Permission: `session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(p === 'media'))` and `setPermissionCheckHandler((_wc, p) => p === 'media')`.
  - Block navigation/new windows: `win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))`; `will-navigate` → `preventDefault()` unless dev URL.
  - IPC: `ipcMain.handle('settings:get', () => settings)`; `ipcMain.handle('settings:set', (_e, patch) => { settings = merge({ ...settings, ...patch }); save(settingsFile, settings); return settings })`; `ipcMain.on('app:quit', () => app.quit())`.
  - `createTray(showWindow)` from `tray.ts`.
- **GOTCHA**: `sandbox: false` is required because Phase 2's preload loads koffi. Compensate with contextIsolation, no nodeIntegration, CSP, and navigation lock. Validate the `patch` type at the trust boundary by passing it through `merge` (done).
- **VALIDATE**: `npm run dev`: ✕ hides the window, the tray "Show" restores it, a second `npm run dev`/exe launch focuses the first.

### Task 8: Tray
- **IMPLEMENT** `src/main/tray.ts`:
```ts
import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'node:path'

let tray: Tray | null = null // module-level so it isn't garbage-collected

export function createTray(show: () => void): Tray {
  const icon = nativeImage.createFromPath(join(app.isPackaged ? process.resourcesPath : 'resources', 'tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('cam-toys')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show cam-toys', click: show },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
  tray.on('click', show)
  return tray
}
```
- **GOTCHA**: Packaged path: add `resources/tray.png` to `extraResources` (Task 10) so it lands in `process.resourcesPath`. Phase 6 extends this menu (Camera toggle, Presets ▸) by **adding** items. Keep `createTray` returning the tray.
- **VALIDATE**: The tray icon shows in dev and in the packaged build.

### Task 9: Preload + renderer placeholder
- **IMPLEMENT**:
  - `src/preload/vcam.ts`: `export const vcam: VcamApi = { available: () => false, start: () => false, send: () => {}, stop: () => {} }` with the comment `// Phase 2 replaces this with the Softcam/koffi bridge.`
  - `src/preload/index.ts`: `contextBridge.exposeInMainWorld('camtoys', api)`, where `api: CamtoysApi = { settings: { get: () => ipcRenderer.invoke('settings:get'), set: (p) => ipcRenderer.invoke('settings:set', p) }, vcam, quit: () => ipcRenderer.send('app:quit') }`.
  - `src/renderer/src/env.d.ts`: `declare global { interface Window { camtoys: import('@engine/types').CamtoysApi } } export {}`.
  - `src/renderer/index.html`: CSP `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: mediastream:; connect-src 'self' blob: data:; worker-src 'self' blob:`. MediaPipe WASM needs `wasm-unsafe-eval` + blob workers, which saves Phase 3 a debugging trip.
  - `tokens.css`: `:root{--bg:#0F0F12;--panel:#1A1A20;--panel-glass:rgba(26,26,32,.72);--border:#2A2A33;--text:#F4F4F5;--muted:#A1A1AA;--purple:#8B5CF6;--pink:#EC4899;--grad:linear-gradient(135deg,var(--purple),var(--pink));--r-sm:8px;--r-md:12px;--r-lg:16px;--font:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif} html,body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font)}`.
  - `App.svelte`: centered gradient-text "cam-toys", muted line "scaffold OK · fps {settings.fps}" read via `window.camtoys.settings.get()` (proves IPC round-trip).
- **GOTCHA**: Don't bundle Inter yet (Phase 4 does). The system fallback is fine.
- **VALIDATE**: The window shows the wordmark and "fps 30".

### Task 10: Packaging
- **IMPLEMENT** `electron-builder.yml`:
```yaml
appId: io.github.allmites.camtoys
productName: cam-toys
directories: { output: dist, buildResources: build }
files: ['out/**', 'package.json']
extraResources:
  - { from: resources/, to: ., filter: ['**/*'] }
asarUnpack: ['**/*.node', '**/*.dll']
win:
  target: [{ target: nsis, arch: [x64] }]
  icon: build/icon.png
nsis:
  oneClick: false
  perMachine: true            # Phase 2 needs admin for regsvr32
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  shortcutName: cam-toys
  artifactName: ${productName}-Setup-${version}.${ext}
publish: { provider: github, owner: AllMites, repo: cam-toys }
```
  `build/installer.nsh`:
```nsis
!macro customInstall
  ; Phase 2: ExecWait 'regsvr32 /s "$INSTDIR\resources\softcam.dll"'
!macroend
!macro customUnInstall
  ; Phase 2: ExecWait 'regsvr32 /s /u "$INSTDIR\resources\softcam.dll"'
!macroend
```
- **GOTCHA**: Check that the GitHub repo name/owner match the real remote (`git remote -v`) and fix `publish` if they differ. With no remote, keep the values and note it for Phase 7. `publish` is ignored without `--publish`.
- **VALIDATE**: `npm run build:win` → `dist/cam-toys-Setup-0.1.0.exe` exists. Install it on this machine (UAC prompt expected), launch from the Start menu, check the tray, then uninstall cleanly.

### Task 11: Icons (no deps)
- **IMPLEMENT** `scripts/make-icons.mjs`: write RGBA PNGs with `node:zlib` `deflateSync` + a hand-rolled CRC32 (~40 lines). Draw a rounded-square (or circle) purple→pink diagonal gradient with a white lens ring (circle radius 0.28, stroke 0.07 of the size, anti-aliased by distance), outputting `build/icon.png` (512) and `resources/tray.png` (32). Commit the generated PNGs and keep the script for regeneration.
- **GOTCHA**: The PNG filter byte is `0` per row. The CRC covers type+data. Use big-endian lengths.
- **VALIDATE**: Open both PNGs (Read tool shows images) and confirm they look right.

### Task 12: README / LICENSE / .gitignore / filters stub + commit
- **IMPLEMENT**: Write the files per the table. `src/filters/index.ts`: `import type { FilterDef } from '@engine/types'; export const filters: FilterDef[] = []` with the comment `// Phase 5 batches append imports here.`
- **GOTCHA**: Phase 5 batches would all edit `src/filters/index.ts` and **conflict**. Use `import.meta.glob` instead so no batch edits a shared file:
```ts
import type { FilterDef } from '@engine/types'
// Every src/filters/<category>/<id>.ts default-exports a FilterDef; picked up automatically.
const mods = import.meta.glob<{ default: FilterDef }>('./*/*.ts', { eager: true })
export const filters: FilterDef[] = Object.values(mods).map((m) => m.default)
```
  Do the same for presets later: `src/presets/*.json` (Phase 6).
- **VALIDATE**: typecheck passes. Commit `feat: electron + svelte scaffold, frozen engine contract` (with the Co-Authored-By line).

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| merge partial | `{fps:60,bogus:1}` | fps 60, defaults rest, no bogus | ✓ |
| merge garbage | `null`, `'nope'` | DEFAULTS | ✓ |

### Edge Cases Checklist
- [x] Corrupt settings.json → defaults + warn (load try/catch)
- [x] Missing settings.json → defaults silently (ENOENT)
- [x] Second instance → focus first
- [ ] Camera permission prompt: none expected (handler auto-allows `media`). Verified in Phase 3.

---

## Validation Commands

```bash
npm install
```
```bash
npm run typecheck
```
EXPECT: 0 errors
```bash
npm test
```
EXPECT: 2 pass
```bash
npm run dev
```
EXPECT: dark window, wordmark, "fps 30", tray icon
```bash
npm run build:win
```
EXPECT: `dist/cam-toys-Setup-0.1.0.exe`

### Manual Validation
- [ ] ✕ hides to tray. Tray click restores it. Tray → Quit exits the process (check Task Manager).
- [ ] Launching twice focuses the existing window.
- [ ] Installer asks for admin, installs to Program Files, Start menu + desktop shortcut work, and uninstall removes them.
- [ ] `%APPDATA%/cam-toys/settings.json` is created after a `settings:set` call (trigger via devtools: `await camtoys.settings.set({fps:60})`, restart, App shows "fps 60").

## Acceptance Criteria
- [ ] Old toys deleted. Repo builds from clean clone with `npm i && npm run build:win`
- [ ] `src/engine/types.ts` matches Task 4 verbatim
- [ ] Folder ownership in place: `src/preload/vcam.ts` + `build/installer.nsh` (Ph2), `src/engine/**` (Ph3), `src/renderer/**` (Ph4), `src/filters/<cat>/**` (Ph5, glob-registered)
- [ ] typecheck + test + build all green

## Completion Checklist
- [ ] No auto-update code left from the template
- [ ] Camera permission limited to `media`, navigation locked, CSP set
- [ ] Comments one-line style, matching the old `cam.js`
- [ ] PRD phase 1 marked complete with this plan linked

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Template ships Svelte 4 / old Electron | M | L | Bump to latest; Context7 check |
| `.ts` import extension friction between Node test + Vite | M | L | Type-only imports; see Task 5 gotcha |
| perMachine NSIS + unsigned → SmartScreen | H | L | Expected; README in Phase 7 |
| Shared-file conflicts in later parallel phases | M | M | `import.meta.glob` registry; ownership table |

## Notes
- Folder ownership for parallel phases is the main point of this phase. Phase 2/3/4 agents get the table from Acceptance Criteria in their briefs.
- `docs/superpowers/` stays as history of the old browser version.
- Confidence: **8/10** for single pass. The only unknowns are template drift and the TS-extension detail, and both have fallbacks written in.
