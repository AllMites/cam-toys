# Plan: Phase 2 — Virtual cam (Softcam + koffi)

## Summary
Build a renamed x64 `softcam.dll` ("cam-toys", own CLSID) from tshino/softcam v1.8.1, load it in the preload with koffi to implement the frozen `VcamApi`, register it from the NSIS installer, add a dev test-pattern sender, and document a visibility checklist.

## User Story
As a non-technical friend, I want "cam-toys" to show up as a webcam in Discord/Zoom, so that I can use filters without OBS.

## Problem → Solution
`vcam.ts` is a stub returning `available() = false` → real DirectShow virtual cam fed from JS.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/cam-toys-desktop.prd.md`
- **PRD Phase**: 2 — Virtual cam
- **Estimated Files**: 7

## UX Design
Internal change. Only visible effect: a "cam-toys" device in other apps' camera lists.

## Mandatory Reading
| Priority | File | Why |
|---|---|---|
| P0 | `src/engine/types.ts` (VcamApi) | Frozen contract |
| P0 | `src/preload/index.ts` | Exposes `vcam` via contextBridge as `window.camtoys.vcam` |
| P0 | `src/main/tray.ts:2` | `?asset` import pattern |
| P1 | `electron-builder.yml` | `files`, `asarUnpack`, `perMachine` |
| P1 | `build/installer.nsh` | NSIS macros to fill |

## External Research
KEY_INSIGHT: Softcam has NO prebuilt release assets (v1.8.1, v1.8, v1.7 all empty) → build from source with MSBuild v143 (VS2022 installed here).
KEY_INSIGHT: API (src/softcam/softcam.h @ afb424c): `void* __cdecl scCreateCamera(int w, int h, float fps)`, `void scDeleteCamera(void*)`, `void scSendFrame(void*, const void*)`, plus `scWaitForConnection`, `scIsConnected`. w,h must be multiples of 4. One instance per system.
KEY_INSIGHT: Frame = top-down BGR24, w*h*3, no row padding; `FrameBuffer::transferToDIB` flips to bottom-up itself → matches contract exactly.
GOTCHA: `scSendFrame` *sleeps* to pace when fps > 0. Preload runs on the renderer thread → create with fps=0 (no sleep; engine paces). Advertised rate then defaults to 60.
GOTCHA: Upstream friendly name is "DirectShow Softcam" with CLSID {AEF3B972-...}. Patch both in the build script so we show as "cam-toys" and don't collide with other softcam-based apps.
GOTCHA: electron-vite `?asset` for files in `resources/` (publicDir) resolves to `join(__dirname,'../../resources/x')` and does NOT copy. `electron-builder.yml` `files` lacks `resources/**`, so nothing in resources/ ships (tray.png too). Needs one-line fix.
KEY_INSIGHT: `?asset&asarUnpack` appends `.replace('app.asar','app.asar.unpacked')`; `asarUnpack: resources/**` already unpacks it.
KEY_INSIGHT: Chromium's Windows capture enumerates MediaFoundation devices then merges DirectShow-only ones, so DS virtual cams (OBS VirtualCam, Softcam) are listed in Chrome/Discord. No MF backend needed unless the manual check says otherwise.

## Files to Change
| File | Action |
|---|---|
| `native/build-softcam.ps1` | CREATE — clone pinned tag, patch name+CLSID, MSBuild Release x64, copy to resources/ |
| `resources/softcam.dll` | CREATE (built, committed) |
| `src/preload/vcam.ts` | UPDATE — koffi bridge + dev test pattern |
| `build/installer.nsh` | UPDATE — regsvr32 /s and /s /u |
| `docs/VCAM.md` | CREATE |
| `package.json` / lock | UPDATE — koffi dep |
| `electron-builder.yml` | UPDATE — add `resources/**` to files (outside ownership, flagged) |

## NOT Building
- MF virtual camera backend (only if checklist fails; ask first).
- Async/worker send path (fps=0 makes send a memcpy).
- CI build of the DLL (Phase 7).

## Tasks
1. **Build DLL** — `native/build-softcam.ps1`: git clone `--branch v1.8.1`, regex-replace `L"DirectShow Softcam"`→`L"cam-toys"` and GUID literal → new GUID, `msbuild softcam.sln /p:Configuration=Release /p:Platform=x64 /t:softcam`, copy `x64/Release/softcam.dll` → `resources/softcam.dll`. VALIDATE: `dumpbin /exports` lists scCreateCamera.
2. **koffi bridge** — load lazily in try/catch; `available()` = loaded && CLSID registered (`reg query HKCR\CLSID\{guid}`). `start` stops previous, calls `scCreateCamera(w,h,0)`, returns non-null. `send` checks length == w*h*3. `stop` deletes. VALIDATE: typecheck; built preload keeps `require("koffi")`.
3. **Test pattern** — `vcam.testPattern(seconds?)` attached only when `!app.isPackaged`-equivalent (`process.env.NODE_ENV !== 'production'` / `ELECTRON_RENDERER_URL` set in dev). Gradient + moving bar + seconds counter drawn as bitmap digits. Expose via the same `vcam` object (contract unchanged; extra key).
4. **Installer** — NSIS macros. VALIDATE: path exists in `dist/win-unpacked/resources/app.asar.unpacked/resources/softcam.dll`.
5. **Docs** — docs/VCAM.md.
6. **Validate** — `npm run typecheck`, `npm test`, `npm run build:win`.

## Validation Commands
```bash
npm run typecheck
npm test
npm run build:win
```

## Manual Validation (user, needs admin)
- `regsvr32 resources\softcam.dll` (elevated), `npm run dev`, devtools: `camtoys.vcam.testPattern()`, check Discord/Zoom/webcamtests/OBS.

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| Discord doesn't list DS cam | L | Checklist; MF backend is the documented fallback |
| koffi .node not unpacked | L | `asarUnpack: '**/*.node'` already present |
| Contract has no "registered vs loaded" split | M | `available()` covers both; UI can't tell which; flag |
