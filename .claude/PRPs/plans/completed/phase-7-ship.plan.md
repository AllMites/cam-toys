# Plan: Phase 7 — Ship

## Summary
Make cam-toys downloadable. A GitHub Actions workflow builds the NSIS installer on a `v*` tag and publishes it to GitHub Releases, and a CI workflow typechecks, tests, builds and smoke-tests on every push. The README is written for non-technical friends (install, SmartScreen, pick "cam-toys" in Discord) with a real screenshot. Also adds third-party notices and package metadata.

## Metadata
- **Complexity**: Small-Medium · **PRD Phase**: 7 — Ship · **Files**: ~7

## Facts gathered
- No git remote. `gh` is logged in as **AllMites**, and `AllMites/cam-toys` does **not** exist yet. Creating it, pushing and tagging are outward-facing, so ask the user first (last step).
- `resources/softcam.dll` (patched, v1.8.1) and `resources/models/*.task` are committed, so CI doesn't need VS or a network model fetch.
- `electron-builder.yml` already has `publish: github AllMites/cam-toys`, NSIS perMachine and regsvr32 in `build/installer.nsh`.
- `npm run smoke` = hidden Electron + Chromium fake camera, 43 filters (scripts/smoke/run.mjs).
- Licenses: MediaPipe tasks-vision + models Apache-2.0; Softcam MIT; Inter OFL-1.1 (`src/renderer/src/assets/fonts/OFL.txt`); Electron MIT.

## Tasks
1. `.github/workflows/ci.yml`: push/PR, `windows-latest`, Node 24, `npm ci`, typecheck, test, build, smoke (upload `out/smoke` as artifact).
2. `.github/workflows/release.yml`: on `v*` tags, `permissions: contents: write`, same checks, then `npx electron-builder --win --x64 --publish always` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. In `electron-builder.yml` set `publish.releaseType: release` so it isn't left as a draft.
3. `scripts/screenshot.mjs` (`npm run screenshot`): launch the built app with a fake camera, a throwaway userData dir and an off-screen window, skip the tutorial, apply the "VHS Night" preset via the UI, `capturePage()` → `docs/screenshot.png`. Never captures the desktop.
4. `README.md`: what it is, screenshot, **Install** (download from Releases → SmartScreen "More info → Run anyway" → UAC yes), **Use it in Discord/Zoom/Meet** (pick camera "cam-toys"), feature list + filter table by category, presets, hotkeys, tray, troubleshooting (camera busy, cam not listed, slow fps), dev section (`npm i`, `dev`, `gallery`, `test`, `smoke`, `build:win`), [Adding a filter](docs/ADDING_A_FILTER.md), [Virtual camera notes](docs/VCAM.md), license + credits.
5. `THIRD_PARTY_NOTICES.md` and bundle it via `extraResources`.
6. `package.json`: `repository`, `homepage`, `bugs`.
7. Validate: typecheck, test, build:win, run screenshot. Commit. Mark PRD phase 7 complete with a report.
8. Ask the user before: `gh repo create AllMites/cam-toys --public`, push `feat/desktop-app` → `main`, tag `v0.1.0`.

## NOT Building
Code signing, auto-update, macOS/Linux targets, CHANGELOG automation.

## Risks
| Risk | Mitigation |
|---|---|
| Smoke flaky on CI GPU (SwiftShader) | CI-only workflow; release job doesn't run smoke |
| SmartScreen blocks the unsigned exe | README walkthrough |
| Models (26 MB) + DLL bloat repo | Accepted; reproducible offline builds |
