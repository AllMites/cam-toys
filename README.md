# cam-toys

Browser camera effects built from scratch, for fun and learning. Vanilla JS, no build.

## Run
```
python -m http.server 8000
```
Open http://localhost:8000. The camera only works on `localhost` or HTTPS, and ES modules need http (not `file://`).

## Toys
ascii, motion, shader, hands, pose. Each is one self-contained `.html` file with a "how it works" comment at the top. Shared camera code is in `cam.js`.

## Status
All five pages load and show the camera-denied message correctly (checked in a camera-blocked browser pane). Live effects need a real camera: open in your own browser. Phone testing needs HTTPS (plain http://LAN-IP blocks the camera).
