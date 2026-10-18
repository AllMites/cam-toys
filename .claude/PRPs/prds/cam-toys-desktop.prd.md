# cam-toys desktop

## Problem Statement

Desktop users who want fun face, hand and body filters on video calls have no good free option since Snap Camera shut down (2023). Instagram's AR filters (e.g. the bear filter) don't work on the laptop, and the alternatives (ManyCam, XSplit VCam) are paid, cluttered or need OBS. Non-technical friends won't install OBS or touch a config file, so if it isn't one installer with obvious buttons, they won't use it.

## Evidence

- Author's direct frustration: Instagram's bear filter isn't available on laptop.
- Snap Camera (the main free desktop AR camera) was discontinued in 2023, leaving a gap.
- The target users are non-technical friends. Assumption: they will drop any tool that needs OBS or manual setup. Validate by watching a friend install it cold.

## Proposed Solution

This is an open-source (MIT) Electron + Svelte + Vite desktop app for Windows. It reads the real webcam, runs MediaPipe face, iris, hand, pose and segmentation tracking only for the active filters, and renders a **stackable** chain of AR and shader filters in WebGL2. It sends the result to its **own virtual camera**, called "cam-toys", which Discord, Zoom, Teams and browsers list as a normal webcam, with no OBS needed. The UI is a dark, Apple-clean shell with a Snapchat-style filter carousel, a layers drawer and a first-run tutorial. It lives in the system tray.

Why this approach: Electron gives a real GUI, a tray icon and an installer with web-tech rendering. MediaPipe Tasks Vision is the free, maintained, GPU-accelerated tracker. A DirectShow virtual camera (Softcam) works on Windows 10 and 11 and is visible to the apps people actually use.

## Key Hypothesis

We believe a one-click installer with its own virtual camera, a preset-first UI and stackable filters will give non-technical friends Snapchat-style video-call filters on desktop.
We'll know we're right when a friend installs it cold and is on a Discord call wearing the bear filter in under 5 minutes, without asking for help.

## What We're NOT Building

- Accounts, cloud or telemetry: local-only, nothing to maintain.
- A filter marketplace or in-app custom filter editor. Docs explain how to add a filter in code instead.
- Mobile.
- macOS and Linux in v1. Their virtual cams need different stacks: CoreMediaIO camera extension plus signing on macOS, v4l2loopback on Linux. Deferred.
- Auto-update. Users download the new installer from Releases.
- Recording or streaming features beyond snapshot. The call app or OBS does that.
- Code signing. That costs money, so the README documents the SmartScreen "Run anyway" step.
- Porting the 5 existing toys. They get deleted, and their ideas (ascii, motion, shader) are rebuilt as filters.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Cold install → in a call with a filter | < 5 min, no help | Watch 1–2 friends |
| Virtual cam visible in apps | Discord, Zoom, Chrome/Meet, Teams, OBS | Manual check list |
| Perf on iGPU, "Bear" preset (face + 1 post fx) | ≥ 30 fps at 720p | In-app fps meter |
| Perf on iGPU, light shader only | ≥ 30 fps at 1080p | fps meter |
| Filter count at launch | ≥ 30 filters, ≥ 8 presets | Catalog |
| Needs OBS | Never | — |

## Open Questions

- [ ] Does Discord desktop (Chromium capture, MediaFoundation-first) list a DirectShow-only Softcam device? If not, add an MF virtual cam (`MFCreateVirtualCamera`, Win11) as a second backend. **Spike in Phase 2 before anything else depends on it.**
- [ ] Softcam frame format and API: confirm `scCreateCamera(w,h,fps)` / `scSendFrame(cam, bgr24)` from the source. Confirm whether prebuilt DLLs exist or CI must build them with MSBuild.
- [ ] Which exact "bear filter"? Assumption: cute bear ears + bear nose + blush + soft skin (the "We Bare Bears" / koala-style Instagram filter). Confirm with author after first render.
- [ ] Sticker art source: procedural/SVG drawn in-repo (default) vs AI-generated PNGs. Must be MIT/CC0-compatible either way.
- [ ] Behaviour when the real webcam is held by another app (Windows exclusive-access): show a clear error with a retry.

---

## Users & Context

**Primary User**
- **Who**: The author's non-technical friends on Windows laptops, often with only integrated graphics, who use Discord/Zoom calls.
- **Current behavior**: Plain webcam. They use phone apps for filters, and Snap Camera is gone.
- **Trigger**: Hopping on a call with friends and wanting to be a bear, have laser eyes, or look like an 80s VHS tape.
- **Success state**: In Discord, they pick camera "cam-toys", open the app from the tray, tap a bubble, and it just works.

**Secondary**: The author (power user who stacks filters on a Logitech 1080p60) and random GitHub visitors who may add filters.

**Job to Be Done**
When I'm on a video call with friends, I want to slap a fun filter on my face in one tap, so I can make them laugh without setting anything up.

**Non-Users**
Streamers needing pro production (they have OBS), enterprise users, mobile users, and people wanting photo editing.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Own virtual camera "cam-toys" (no OBS), registered by installer | Core promise |
| Must | NSIS installer from GitHub Releases, built by GitHub Actions on tag | Friends need one file |
| Must | Tray icon: close-to-tray, menu (Show, Camera on/off, Presets ▸, Quit) | "Lives in taskbar" |
| Must | Filter stacking (layers: add, remove, reorder, toggle, per-layer params) | Differentiator |
| Must | ≥ 30 filters across categories (catalog below) and ≥ 8 presets on the Featured row | "What they normally use and more" |
| Must | First-run tutorial walkthrough plus per-filter tooltip with "what it does / how to trigger" | Non-technical users |
| Must | Heavy-filter warning (⚡ badge plus toast on iGPU or when fps < 24) | iGPU target |
| Must | Camera picker plus resolution/fps setting (720p30 default, up to 1080p60) | Author's Logitech |
| Should | Global hotkey to cycle presets (Ctrl+Alt+→/←) | Use mid-call without the window |
| Should | Snapshot to PNG (saved to Pictures/cam-toys) | Sharing laughs |
| Should | Randomize button (random preset stack) | Fun |
| Should | Mirror toggle for preview only (output stays un-mirrored, as call apps expect) | Avoid "my text is backwards" confusion |
| Should | Auto-degrade: lower tracker resolution when fps drops | iGPU |
| Could | "Off" placeholder frame (logo card) when the app is paused | Polish |
| Could | GIF capture | Fun |
| Won't | macOS/Linux, auto-update, custom-filter UI, cloud | See NOT building |

### Filter Catalog (v1)

Cost: L = shader only, M = one tracker, H = 2+ trackers or segmentation. `needs` decides which MediaPipe models load.

| Category | Filter | Needs | Cost | Interaction |
|----------|--------|-------|------|-------------|
| Face AR | **Bear** (ears, nose, blush, soft skin) | face | M | — |
| Face AR | Puppy (ears, nose; tongue when mouth opens) | face | M | mouth open |
| Face AR | Cat | face | M | — |
| Face AR | Bunny | face | M | — |
| Face AR | Flower crown | face | M | — |
| Face AR | Deal-with-it sunglasses (drop in on smile) | face | M | smile |
| Face AR | Party hat + confetti on mouth open | face | M | mouth open |
| Face AR | Big head / tiny face (warp) | face | M | — |
| Face AR | Face mesh / wireframe (techy) | face | M | — |
| Face AR | Beauty (skin smooth, brighten) | face | M | — |
| Eyes | Laser eyes | face (iris) | M | eyes wide |
| Eyes | Glowing eyes (color pick) | face (iris) | M | — |
| Eyes | Anime big eyes (warp) | face (iris) | M | — |
| Eyes | Iris recolor | face (iris) | M | — |
| Expressions | Rainbow puke (mouth open) | face | M | mouth open |
| Expressions | Fire breath | face | M | mouth open |
| Expressions | Blink → camera flash/glitch burst | face | M | blink |
| Hands | Finger paint (index tip draws neon) | hands | M | pinch toggles |
| Hands | Particle hands (sparkles from fingertips) | hands | M | — |
| Hands | Gesture FX: ✌️ hearts, 👍 stars, 🤘 lightning, ✋ freeze | hands (+gesture) | M | gestures |
| Hands | Hand skeleton | hands | M | — |
| Body | Skeleton (Kinect-style) | pose | M | — |
| Body | Ghost / clone trails | segment | H | — |
| Body | Neon outline / silhouette glow | segment | H | — |
| Background | Blur | segment | M | — |
| Background | Replace (built-in scenes: space, beach, office, gradient) | segment | M | — |
| Background | Remove → color | segment | M | — |
| Color | LUT grades (Warm, Cool, Teal-Orange, B&W, Sepia, Pastel, Cyberpunk) | — | L | — |
| Color | Thermal | — | L | — |
| Color | Night vision | — | L | — |
| Retro | VHS (tracking lines, chroma bleed) | — | L | — |
| Retro | CRT (scanlines, curvature) | — | L | — |
| Retro | Glitch / datamosh | — | L | — |
| Retro | Pixelate / 8-bit palette | — | L | — |
| Retro | ASCII | — | L | — |
| Art | Comic / toon (edges + posterize) | — | L | — |
| Art | Kaleidoscope | — | L | — |
| Art | Mirror (L/R/quad) | — | L | — |
| Art | Chromatic aberration | — | L | — |
| Art | Film grain + vignette | — | L | — |
| Motion | Motion trails / time echo | — | L | — |

**Presets (Featured row, in order):** Bear · Puppy · Cozy (Beauty + Warm + Blur bg) · Laser Eyes · Anime · VHS Night · Cyberpunk (Neon outline + Cyberpunk LUT + Chromatic) · Space Office (bg replace) · Finger Paint · Clean (no filter).

### MVP Scope

Virtual cam visible in Discord and Zoom, installer, tray, layer stack, plus Bear, Puppy, Laser eyes, Blur bg, 3 LUTs and VHS. The rest of the catalog fills in during Phase 5, which agents run in parallel.

### User Flow

Install `.exe` (SmartScreen: More info → Run anyway; UAC yes) → app opens → tutorial (5 cards: pick camera → tap a bubble → stack in Layers → open Discord, choose "cam-toys" → it lives in the tray) → tap **Bear** → Discord shows the bear.

### UI Design

- **Style**: hybrid. An Apple-clean dark shell (frosted panels, 12–16px radii, soft shadows, generous spacing) with a Snapchat-style round filter carousel. Dark mode only in v1.
- **Palette**: graphite grays (bg `#0F0F12`, panels `#1A1A20` frosted, borders `#2A2A33`). Accents: purple `#8B5CF6` (primary), pink `#EC4899` (active/live), gradient purple→pink on the "LIVE" pill and the selected bubble ring. Text `#F4F4F5` / `#A1A1AA`.
- **Layout**: big rounded preview centered. Top bar has camera picker, `● LIVE in cam-toys` pill (pink when frames are flowing), fps meter and settings gear. Bottom has category tabs (Featured, Face, Eyes, Hands, Body, Background, Color, Retro, Art) over a horizontal carousel of round bubbles (icon + name, ⚡ for heavy). The right drawer, "Layers", has drag-to-reorder cards, an eye toggle, sliders and color pickers per param, and a ✕ to remove.
- **Motion**: subtle spring on bubble select. Tracker models show a loading shimmer.
- **Font**: Inter (bundled), with system fallback.

---

## Technical Approach

**Feasibility**: MEDIUM-HIGH. Tracking and shaders are proven web tech. The virtual cam is the one native piece and the main risk.

**Architecture Notes**
- **Stack**: Electron (latest stable), Svelte 5 + Vite + TypeScript (electron-vite or plain Vite with two entries), electron-builder (NSIS). Verify current APIs via Context7 at build time.
- **Process model**: The renderer does capture, tracking and render. The main process owns the tray, hotkeys, settings JSON and window. The preload exposes `vcam.start(w,h,fps)`, `vcam.send(Uint8Array)` and `vcam.stop()` over `contextBridge`, and loads the Softcam DLL with **koffi** (FFI, no node-gyp compile). `contextIsolation: true`, `sandbox: false` for the preload only, and no remote content is loaded.
- **Virtual cam backend (Windows)**: [Softcam](https://github.com/tshino/softcam) (MIT, DirectShow "Video Input Device" filter, Win10 and 11). The NSIS installer runs as per-machine/admin and calls `regsvr32 /s softcam.dll` on install and `/u` on uninstall. CI builds the DLL with MSBuild if no prebuilt release exists. Fallback/second backend: an MF virtual camera via `MFCreateVirtualCamera` (Win11 22000+, ref [VCamSample](https://github.com/smourier/VCamSample), [neon](https://github.com/newdee/neon)), used only if the Phase 2 spike shows Discord/Chromium can't see DirectShow devices.
- **Frame path**: WebGL2 final pass renders flipped and un-mirrored into a 1280×720 FBO → `readPixels` RGBA → preload converts RGBA→BGR24 (simple loop; worker if it costs > 4 ms) → `scSendFrame`. Target 30 fps, with an option for 60.
- **Tracking**: `@mediapipe/tasks-vision` with the GPU delegate. It has FaceLandmarker (478 points + iris + blendshapes for mouth open, blink, smile), HandLandmarker plus GestureRecognizer, PoseLandmarker (lite), and ImageSegmenter (selfie). Models are bundled in `resources/models` so the app works offline. Each model loads lazily, only when an active layer's `needs` includes it, and unloads when no layer needs it. Trackers run on a downscaled frame (e.g. 640×360).
- **Render engine**: a small custom WebGL2 pass chain with ping-pong FBOs. Every layer is a pass. AR stickers are textured quads and warps placed from landmarks, in the same GL context. No three.js unless a filter truly needs 3D (YAGNI).
- **Filter contract** (the API the UI and filter-pack agents code against):

```ts
// src/engine/types.ts
export type Need = 'face' | 'hands' | 'gestures' | 'pose' | 'segment';
export type Param =
  | { type: 'range'; label: string; min: number; max: number; step?: number; default: number }
  | { type: 'color'; label: string; default: string }
  | { type: 'select'; label: string; options: string[]; default: string }
  | { type: 'toggle'; label: string; default: boolean };

export interface FilterDef {
  id: string; name: string; category: Category; icon: string; // emoji or svg path
  cost: 'light' | 'medium' | 'heavy';
  needs: Need[];
  hint: string;                       // tutorial/tooltip text: "Open your mouth!"
  params: Record<string, Param>;
  create(gl: WebGL2RenderingContext): FilterInstance;
}
export interface FilterInstance {
  render(f: Frame, params: Record<string, unknown>): void; // read f.input texture, draw to f.output FBO
  dispose(): void;
}
export interface Frame {
  input: WebGLTexture; output: WebGLFramebuffer | null;
  width: number; height: number; time: number; dt: number;
  face?: FaceResult; hands?: HandsResult; pose?: PoseResult; mask?: WebGLTexture;
}
```

  Filters live one file each in `src/filters/<category>/<id>.ts` and are auto-registered by `import.meta.glob` in `src/filters/index.ts`, so no shared file is edited by filter batches. `docs/ADDING_A_FILTER.md` documents this.
- **State**: Svelte stores for layers, presets and settings. Settings persist to `app.getPath('userData')/settings.json` via the main process.
- **Assets**: Stickers are drawn in-repo as SVGs (rasterized to textures at load). Backgrounds come from procedural shaders or CC0 images. MediaPipe models are Apache-2.0, so ship `THIRD_PARTY_NOTICES`.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Discord/Chromium doesn't list the DirectShow cam | M | Spike first (Phase 2). MF virtual cam backend fallback for Win11 |
| Softcam needs admin to register; unsigned installer triggers SmartScreen | H | perMachine NSIS; README section with screenshots |
| iGPU can't run face + segmentation + post fx at 30 fps | M | Lazy trackers, downscaled inference, ⚡ warnings, auto-degrade |
| `readPixels` + BGR conversion stalls the GPU pipeline | M | PBO async readback (WebGL2 `PIXEL_PACK_BUFFER` + fence); worker conversion |
| Real webcam locked by another app | M | Clear error card + retry; tutorial tells users to pick "cam-toys" in the call app, not the real cam |
| koffi/Softcam ABI mismatch (x64) | L | x64-only build; smoke test in CI that loads the DLL |
| Many parallel agents editing the same files | M | Strict file ownership per phase (below) and the frozen contract in `types.ts` |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Scaffold | Electron + Svelte + Vite + TS, delete old toys, tray, window, settings IPC, `types.ts` contract frozen | complete | - | - | [plan](../plans/completed/phase-1-scaffold.plan.md) · [report](../reports/phase-1-scaffold-report.md) |
| 2 | Virtual cam | Softcam build + koffi preload bridge + NSIS register + Discord/Zoom visibility spike | complete | with 3, 4 | 1 | [plan](../plans/completed/phase-2-vcam.plan.md) · `docs/VCAM.md` |
| 3 | Engine | Camera capture, tracker manager (lazy MediaPipe), WebGL2 pass chain, layer stack runtime, fps meter | complete | with 2, 4 | 1 | [plan](../plans/completed/phase-3-engine.plan.md) · [report](../reports/phase-3-engine-report.md) |
| 4 | UI shell | Design tokens, layout, carousel, layers drawer, param controls, settings, tutorial (against mock engine) | complete | with 2, 3 | 1 | [plan](../plans/completed/phase-4-ui-shell.plan.md) · [report](../reports/phase-4-ui-shell-report.md) |
| 5 | Filter pack | Catalog filters in 5 parallel batches: Face AR · Eyes+Expressions · Hands · Body+Background · Color+Retro+Art+Motion | complete | batches parallel | 3 | commit d89365e (43 filters, headless smoke) |
| 6 | Integrate | Wire UI ↔ engine ↔ vcam, presets, hotkeys, snapshot, heavy warnings, auto-degrade | complete | - | 2, 4, 5 | [plan](../plans/completed/phase-6-integrate.plan.md) · [report](../reports/phase-6-integrate-report.md) |
| 7 | Ship | GitHub Actions release on tag, README (install + SmartScreen + Discord setup), ADDING_A_FILTER.md, notices, smoke test | pending | - | 6 | - |

### Phase Details

**Phase 1: Scaffold**
- **Goal**: A buildable empty app that agents can work in at the same time.
- **Scope**: Delete `*.html`, `cam.js` and the old README content. `package.json`, electron-vite (or equivalent) config, `src/main` (window, tray, close-to-tray, single-instance lock, settings JSON IPC), `src/preload` stub, `src/renderer` Svelte root, `src/engine/types.ts` (contract above), electron-builder NSIS config (x64, perMachine), MIT LICENSE, `.gitignore`.
- **Success signal**: `npm run dev` opens a dark window with a tray icon. `npm run build` produces an installer.

**Phase 2: Virtual cam** (owns `native/`, `src/preload/vcam.ts`, `build/installer.nsh`)
- **Goal**: Frames from JS appear as webcam "cam-toys" in other apps.
- **Scope**: Get or build `softcam.dll` (x64). koffi bindings. `vcam.start/send/stop`. Test pattern sender. NSIS include for regsvr32. **Spike**: verify visibility in Discord, Zoom, Chrome (webcamtests page) and OBS, and record the results in `docs/VCAM.md`. If Discord fails, implement the MF backend.
- **Success signal**: A moving test pattern shows in Discord's camera preview with no OBS installed.

**Phase 3: Engine** (owns `src/engine/**`)
- **Goal**: Webcam → tracked → layered GL render at 30 fps.
- **Scope**: `getUserMedia` with device/res/fps choice. Tracker manager (lazy load and unload by `needs`, GPU delegate, downscaled input, shared results per frame). Ping-pong FBO pass chain. Layer runtime (add, remove, reorder, params). Final pass to the screen canvas plus an output FBO, with async readback producing a frame for vcam. Engine API: `engine.setLayers()`, `engine.on('fps')`, `engine.snapshot()`. 2 sample filters (invert, face-dots) to prove the contract.
- **Success signal**: Sample filters stack and run at ≥ 30 fps on an iGPU at 720p.

**Phase 4: UI shell** (owns `src/renderer/**` except the engine wiring file)
- **Goal**: The full UI from the design section, working against a mock engine and a mock filter registry.
- **Scope**: Tokens (CSS vars), top bar, preview frame, category tabs, carousel bubbles, layers drawer (drag reorder, toggle, auto-generated param controls from `Param`), settings modal (camera, resolution, fps, hotkeys, run-on-startup off by default), tutorial overlay (5 steps, re-openable from settings), toasts, ⚡ warning dialog, empty/error states (no camera, camera busy, vcam not registered).
- **Success signal**: Every screen and state is reachable with mock data. Screenshots look polished.

**Phase 5: Filter pack** (each batch owns only `src/filters/<category>/**`)
- **Goal**: The full catalog, with each filter one file following the contract.
- **Scope**: 5 agents, one per batch listed in the table. Each filter gets a sensible default, 1–3 params, a `hint` and a cost tag. Sticker SVGs go in `src/filters/<category>/assets/`.
- **Success signal**: Each filter renders correctly in a dev "filter gallery" page, and none drops below 24 fps alone on an iGPU (except ⚡).

**Phase 6: Integrate**
- **Goal**: One working app.
- **Scope**: Replace the mock engine with the real one. Engine output → vcam. Presets file + Featured row. Global hotkeys. Tray presets submenu. Snapshot. Randomize. ⚡ warnings + auto-degrade. Persist the last stack.
- **Success signal**: The full user flow works end-to-end on a fresh Windows machine/VM.

**Phase 7: Ship**
- **Goal**: Friends download and install.
- **Scope**: `.github/workflows/release.yml` (windows-latest, build softcam if needed, `npm ci`, `electron-builder --win --publish always` on `v*` tag). README with a GIF, install steps, SmartScreen note, "pick cam-toys in Discord" and troubleshooting. `docs/ADDING_A_FILTER.md`. `THIRD_PARTY_NOTICES`. Smoke test that loads the DLL and starts the vcam in CI.
- **Success signal**: Tag `v0.1.0`, the release has the `.exe`, and a friend installs it cold in < 5 min.

### Parallelism Notes

After Phase 1 freezes `types.ts` and the folder layout, Phases 2, 3 and 4 touch disjoint folders (`native`+`preload`, `engine`, `renderer`) and run in parallel. Phase 5 needs only the engine contract plus a working pass chain, and its 5 batches own separate `src/filters/<category>` folders, so they run in parallel too. Phase 6 is the single-writer merge point, and Phase 7 is sequential. Rule for all agents: never edit files outside your owned folder. Request contract changes in your report instead.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Shell | Electron | Tauri, web page | Author asked; tray, installer and web-GL all built in |
| UI framework | Svelte 5 + Vite + TS | React, vanilla | Author pick; small and fast |
| Virtual cam | Softcam (DirectShow) first, MF vcam fallback | OBS vcam, akvirtualcamera, MF only | No OBS; Win10+11; MIT; simple sender API |
| Native binding | koffi FFI in preload | node-addon-api C++ addon | No compile step; less code |
| Tracking | MediaPipe Tasks Vision, lazy per filter | TF.js, ONNX | Free, GPU, face+iris+hands+pose+segment in one package |
| Renderer | Custom WebGL2 pass chain | three.js, PixiJS | Stacking = pass chain; fewer deps |
| Platform | Windows x64 only v1 | +mac/Linux | Different vcam stacks; defer |
| Style | Apple-clean dark shell + Snap carousel; gray/purple/pink | Neumorphic, pure flat | Author pick (D) |
| Default output | 720p30, settings to 1080p60 | 1080p default | iGPU target; author's Logitech can go higher |
| Old toys | Delete, rebuild as filters | Port | Author: overhaul |
| Updates | Manual from Releases | electron-updater | Author: no auto-update |
| License | MIT | — | Author |

---

## Research Summary

**Market Context**
Snap Camera (discontinued 2023) was the free desktop AR leader. ManyCam and XSplit VCam are paid, and NVIDIA Broadcast is RTX-only with no fun filters. Webcam Toy is browser-only with no virtual cam. Classic most-used lenses: dog, flower crown, face swap, bunny/deer/koala animal ears, rosy cheeks ([Trusted Reviews 2016 top lenses](https://www.trustedreviews.com/news/these-were-the-most-popular-snapchat-filters-and-lenses-of-2016-2948575), [The Fader on IG face filters](https://www.thefader.com/2017/05/16/instagram-snapchat-filters)). The "bear filter" most likely refers to the cute-bear-ears/blush style ([example description](https://didongviet.vn/dchannel/filter-instagram/)). That source is weak, so confirm with the author. Stacking several effects is rare in consumer tools and is our differentiator.

**Technical Context**
- [tshino/softcam](https://github.com/tshino/softcam): a DirectShow Video Input Device DLL with a sender API (`scCreateCamera`, frame send). It needs a VS2022 build and registration before apps see it.
- [smourier/VCamSample](https://github.com/smourier/VCamSample) and [newdee/neon](https://github.com/newdee/neon): MF virtual cam via `MFCreateVirtualCamera`, Win11 22000+ only. The media source DLL is registered in HKLM (admin).
- [IMFVirtualCamera docs](https://learn.microsoft.com/en-us/windows/win32/api/mfvirtualcamera/nn-mfvirtualcamera-imfvirtualcamera).
- Existing repo: 5 vanilla HTML toys + `cam.js`. No reusable architecture, so it gets replaced.

---

*Generated: 2026-10-18*
*Status: DRAFT - needs validation (vcam spike, bear filter identity)*
