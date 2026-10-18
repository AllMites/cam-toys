// Webcam capture as a VideoFrame stream, plus friendly errors.

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices()
  return all.filter((d) => d.kind === 'videoinput')
}

/** Map getUserMedia DOMExceptions to messages a non-technical user understands. */
export function cameraError(e: unknown): Error {
  const name = (e as { name?: string })?.name
  const msg =
    name === 'NotAllowedError' || name === 'SecurityError'
      ? 'Camera permission was denied.'
      : name === 'NotReadableError' || name === 'AbortError'
        ? 'Camera is busy. Close other apps using it (Zoom, Discord, OBS) and try again.'
        : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No camera found. Plug one in or pick another in settings.'
          : `Camera failed: ${(e as Error)?.message ?? String(e)}`
  return Object.assign(new Error(msg), { name: name ?? 'Error', cause: e })
}

// Chromium exposes this on window (spec: workers only), so lib.dom has no type for it.
declare const MediaStreamTrackProcessor: new (init: { track: MediaStreamTrack; maxBufferSize?: number }) => {
  readable: ReadableStream<VideoFrame>
}

/**
 * Open the camera as a stream of VideoFrames. Unlike <video> + requestVideoFrameCallback,
 * this keeps full rate while the window is hidden in the tray (measured: rVFC drops to 1/s).
 */
export async function openCamera(
  deviceId: string | undefined,
  width: number,
  height: number,
  fps: number
): Promise<{ track: MediaStreamTrack; frames: ReadableStreamDefaultReader<VideoFrame> }> {
  if (typeof MediaStreamTrackProcessor === 'undefined') throw new Error('This browser cannot read camera frames (no MediaStreamTrackProcessor).')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: fps }
      }
    })
  } catch (e) {
    throw cameraError(e)
  }
  const track = stream.getVideoTracks()[0]
  // maxBufferSize 1: if we fall behind, skip to the newest frame instead of queueing.
  const frames = new MediaStreamTrackProcessor({ track, maxBufferSize: 1 }).readable.getReader()
  return { track, frames }
}
