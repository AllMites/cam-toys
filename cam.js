// Shared camera helper. Every toy imports from here.

// Ask for the webcam, attach it to a hidden <video>, resolve once frames are flowing.
export async function startCamera() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
  } catch (err) {
    throw new Error('Camera unavailable: ' + err.name);
  }
  const video = document.createElement('video');
  video.playsInline = true; // iOS: don't go fullscreen
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  // videoWidth is 0 until the first frame decodes; wait so callers can trust it.
  while (video.videoWidth === 0) await new Promise((r) => requestAnimationFrame(r));
  return video;
}

// Replace the page with one plain message.
export function showError(msg) {
  document.body.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = msg;
  p.style.cssText = 'font:16px system-ui;padding:2rem;color:#c00';
  document.body.append(p);
}

// Make the canvas pixel size match the video so nothing is stretched.
export function fitCanvas(canvas, video) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}
