# Implementation Report: Phase 7 — Ship

## Summary
Added a CI workflow (typecheck, test, build and the 43-filter smoke test on push/PR) and a Release workflow (on a `v*` tag: test, build, then `electron-builder --publish always` to a published GitHub Release). Wrote a non-technical README (install, SmartScreen, pick "cam-toys" in the call app, filter table, shortcuts, troubleshooting, dev section) with a real screenshot, plus `THIRD_PARTY_NOTICES.md` (bundled into the installer with LICENSE) and package repository metadata.

## Validation
| Check | Result |
|---|---|
| Typecheck | 0 errors |
| Tests | 14 pass |
| `npm run build:win` | `dist/cam-toys-Setup-0.1.0.exe` (164 MB) with LICENSE.txt + notices in resources |
| Screenshot | `npm run screenshot` → `docs/screenshot.png` (built app, fake camera, off-screen window, VHS Night preset) |
| GitHub workflows | **Not run yet**: no remote. Needs repo creation + push + tag |

## Deviations / findings
- **Bug found by the screenshot and fixed**: the fps meter showed the engine's raw float (`20.4575…`). It's now rounded in `onStats` (which also fixes the slow-fps toast text).
- **Screenshot script**: Electron fires `ready` only after the ESM entry finishes evaluating, so a top-level `await app.whenReady()` deadlocks. Wrapped the work in `whenReady().then(shoot)` and imported main via `pathToFileURL` (Windows ESM needs file:// URLs).
- The release job skips the smoke test (GPU/fake-camera flakiness on hosted runners shouldn't block a release). CI runs it.
- `publish.releaseType: release` so tags produce a public release, not a draft.

## Open
- First CI run on GitHub may need tweaks (smoke under the runner's software GL).
- The installer is unsigned. The README walks users through SmartScreen.
