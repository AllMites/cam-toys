# Virtual camera ("cam-toys")

## How it works

- `resources/softcam.dll` is [tshino/softcam](https://github.com/tshino/softcam) v1.8.1 (MIT), a DirectShow "Video Input Device" filter. `native/build-softcam.ps1` builds it with two patches: the device name is **cam-toys** and the CLSID is our own (`{1CAB239F-CB40-4AF9-B98C-9623FA4382B0}`), so it never clashes with another Softcam-based app. It links the CRT statically, so it needs no VC++ redistributable.
- Once registered (`regsvr32`), any app that lists DirectShow cameras (Discord, Zoom, Chrome, Teams, OBS) shows "cam-toys". The app loads the DLL into its own process. The DLL reads frames from shared memory; while cam-toys isn't sending, apps get no live image.
- cam-toys (the sender) loads the same DLL in the preload with [koffi](https://koffi.dev) and calls `scCreateCamera(w, h, 0)`, `scSendFrame(cam, bgr)` and `scDeleteCamera(cam)`. Frames are BGR24, top-down, `w*h*3` bytes; Softcam flips them for DirectShow. Width and height must be multiples of 4. Only one sender can exist on the system at a time.
- The rate passed to Softcam is `0`, so `scSendFrame` never sleeps on the renderer thread. The engine paces frames, and apps see a nominal 60 fps format.
- `vcam.available()` is true when the DLL loads **and** the CLSID is registered under `HKCR\CLSID`.
- The installer (per-machine, admin) runs `regsvr32 /s` on install and `regsvr32 /s /u` on uninstall for `$INSTDIR\resources\app.asar.unpacked\resources\softcam.dll` (`build/installer.nsh`).

## Rebuild the DLL

Needs git and Visual Studio 2022 or Build Tools 2022 with the C++ (v143) workload.

```bash
powershell -ExecutionPolicy Bypass -File native/build-softcam.ps1
```

## Dev setup: register by hand

Run an **elevated PowerShell** (Win+X → Terminal (Admin)), `cd` to the repo root, then:

```bash
regsvr32 "$PWD\resources\softcam.dll"
```

Registration stores the absolute path, so register the copy you'll keep. Re-register if you move the repo. To remove it:

```bash
regsvr32 /u "$PWD\resources\softcam.dll"
```

Check whether it is registered (no admin needed):

```bash
reg query "HKCR\CLSID\{1CAB239F-CB40-4AF9-B98C-9623FA4382B0}\InprocServer32"
```

## Test pattern (dev builds only)

1. `npm run dev`
2. Open devtools (Ctrl+Shift+I) → Console:
   ```js
   camtoys.vcam.available()      // true once registered
   camtoys.vcam.testPattern(120) // 1280x720 gradient + moving white bar + seconds counter, for 120 s
   ```
3. In the other app, pick the camera **cam-toys**. Before the pattern runs (or after it stops) there is no live image.

## Visibility checklist

Fill in with ✅ / ❌ and notes (version, Windows build). "Listed" = appears in the camera list. "Live" = the moving pattern shows.

| App | Listed | Live | Notes |
|---|---|---|---|
| Discord desktop (Settings → Voice & Video → Camera) | ✅ | ✅ | user-verified 2026-10-18; gallery 30 fps |
| Zoom desktop (Settings → Video) | | | |
| Chrome — https://webcamtests.com | | | |
| OBS (Video Capture Device) | | | |
| Teams (optional) | | | |
| Windows Camera app (expected ❌: MF-only) | | | |

Windows build: ______  Tester: ______  Date: ______

## If Discord doesn't list it

Chromium (Discord, Chrome, Teams) lists MediaFoundation cameras and adds DirectShow-only ones, which is how OBS Virtual Camera shows up. So we expect DirectShow to be enough. If the checklist shows ❌ for Discord, the fallback is an MF virtual camera (`MFCreateVirtualCamera`, Windows 11 22000+, see [VCamSample](https://github.com/smourier/VCamSample)). That is a separate backend, not built yet.

## Known limits

- Upgrading or uninstalling while Discord/Zoom has the camera open can leave the DLL locked. Close those apps first.
- Windows apps that only use MediaFoundation's frame server (the Camera app, some UWP apps) won't see it.
