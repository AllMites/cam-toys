# Implementation Report: Phase 1 — Scaffold

## Summary
The 5 vanilla toys are replaced by an electron-vite + Svelte 5 + TS app. It has a dark placeholder window, a tray with close-to-tray, a single-instance lock, a media-only permission handler, navigation lock + CSP, settings JSON over IPC, generated icons, and an NSIS perMachine installer. The contract in `src/engine/types.ts` is frozen, and the filter registry is `import.meta.glob`.

## Assessment vs Reality
| Metric | Predicted | Actual |
|---|---|---|
| Complexity | Medium-Large | Medium |
| Confidence | 8/10 | Held; no blockers |
| Files | ~20 created, 7 deleted | 24 created, 7 deleted |

Versions from the template: Electron 44, electron-vite 6, Vite 8, Svelte 5.57, electron-builder 26.

## Validation
| Level | Status | Notes |
|---|---|---|
| Typecheck | Pass | tsc (node) + svelte-check, 0 errors |
| Unit tests | Pass | 2 (`src/main/settings.test.ts`) |
| Build | Pass | `dist/cam-toys-Setup-0.1.0.exe` (112 MB) |
| Single instance | Pass | Second launch → only 1 main process remains |
| Window/tray visual | Not checked | The user was on a live call; screenshots stopped |
| Installer install/uninstall | Not run | Needs UAC → user's action |

## Deviations
- **Tray icon path**: uses electron-vite `?asset` import (`resources/tray.png?asset`) instead of `process.resourcesPath`, with the template's `asarUnpack: resources/**`. It works in dev and packaged without extraResources. **Phase 2 consequence**: put `softcam.dll` in `resources/`; installed path `$INSTDIR\resources\app.asar.unpacked\resources\softcam.dll` (already in the `installer.nsh` comments).
- **Single-instance**: `app.exit(0)` instead of `app.quit()`. quit() is async and whenReady would still create a tray/window in the second instance.
- **Dropped**: eslint/prettier, `@electron-toolkit/preload` (our own bridge), template mac/linux config.
- `tsconfig.web.json` `strict: true` (the template had false).

## Issues
- Node warns "module type not specified" when running `node --test` on TS files. Harmless. Adding `"type":"module"` would change electron-vite output format, so it was skipped.
- `electron-winstaller` install script not in allowScripts (npm warning); not needed for NSIS.

## Folder ownership for parallel phases
| Phase | Owns |
|---|---|
| 2 vcam | `src/preload/vcam.ts`, `native/`, `build/installer.nsh`, `resources/softcam.dll` |
| 3 engine | `src/engine/**` (except `types.ts`: frozen) |
| 4 UI | `src/renderer/**` |
| 5 filters | `src/filters/<category>/**` (auto-registered) |
| 6 integrate | `src/main/**`, wiring, presets |
