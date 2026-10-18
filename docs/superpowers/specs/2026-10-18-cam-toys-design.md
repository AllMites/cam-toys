# cam-toys — design

## Intent
Fun + learning. Rebuild well-known camera effects and Kinect-style interactions
from scratch in the browser, readable enough to learn from. "Reverse engineer"
used loosely: see how effects work by building them.

## Constraints
- Browser only, webcam/phone camera. No backend, accounts, or build step.
- Vanilla HTML + JS. One self-contained file per effect, readable top to bottom.
- Camera needs `localhost` or HTTPS.
- Webcam has no depth sensor. "Kinect-style" = frame-diff motion + MediaPipe body/hand tracking.

## Layout
```
cam-toys/
  index.html      links to every toy
  cam.js          shared helper: start camera, return <video>; ~20 lines
  ascii.html
  motion.html
  shader.html
  hands.html
  pose.html
  README.md       how to run
```
Each toy starts with a `how it works` comment block, then imports `cam.js`.
MediaPipe loaded from a pinned CDN version in `hands.html` / `pose.html` only.

## Toys (build order, each teaches one idea)
1. `ascii.html` — pixel loop: canvas getImageData, brightness -> character.
2. `motion.html` — frame differencing: trails, motion heatmap, wave-to-pop bubbles.
3. `shader.html` — WebGL fragment shader on video texture: glitch, kaleidoscope.
4. `hands.html` — MediaPipe Hands: air-draw with index finger, pinch to grab.
5. `pose.html` — MediaPipe Pose: skeleton puppet, silhouette mask, simple interactive toy.

## Error handling
Camera denied/missing: show one plain message in the page. No retries, no fallbacks.

## Testing
Manual: open each page, check effect responds to the camera. One smoke check:
`cam.js` exports the start function (open `index.html`, no console errors).
No test framework.

## Run
`python -m http.server 8000` in the repo folder, open `http://localhost:8000`.
Phone testing: publish privately over HTTPS (decide later).

## Out of scope (YAGNI)
Frameworks, bundlers, recording/export, settings UI, depth estimation models,
accounts, deployment.
