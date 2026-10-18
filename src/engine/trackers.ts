// Lazy MediaPipe trackers. Each model loads only while some enabled layer needs it,
// runs once per camera frame on a downscaled copy, and closes when nothing needs it.
import {
  FaceLandmarker,
  GestureRecognizer,
  HandLandmarker,
  ImageSegmenter,
  PoseLandmarker
} from '@mediapipe/tasks-vision'
// Relative paths: the package only exports '.', and `?url` makes Vite copy the files at build.
import wasmLoaderPath from '../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url'
import wasmBinaryPath from '../../node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url'
import faceModel from '../../resources/models/face_landmarker.task?url'
import handModel from '../../resources/models/hand_landmarker.task?url'
import gestureModel from '../../resources/models/gesture_recognizer.task?url'
import poseModel from '../../resources/models/pose_landmarker_lite.task?url'
import segmentModel from '../../resources/models/selfie_segmenter_landscape.tflite?url'
import type { FaceResult, HandsResult, Need, PoseResult } from './types'

const fileset: Parameters<typeof FaceLandmarker.createFromOptions>[0] = { wasmLoaderPath, wasmBinaryPath }
const TRACK_W = 640 // ponytail: fixed downscale width; make it a setting if auto-degrade needs it

type Kind = 'face' | 'hands' | 'gestures' | 'pose' | 'segment'
type Task = FaceLandmarker | HandLandmarker | GestureRecognizer | PoseLandmarker | ImageSegmenter

const VIDEO = { delegate: 'GPU' as const }
const load: Record<Kind, () => Promise<Task>> = {
  face: () =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: faceModel, ...VIDEO },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true // ponytail: 1 face; raise for group calls
    }),
  hands: () =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: handModel, ...VIDEO }, runningMode: 'VIDEO', numHands: 2
    }),
  gestures: () =>
    GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: gestureModel, ...VIDEO }, runningMode: 'VIDEO', numHands: 2
    }),
  pose: () =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: poseModel, ...VIDEO }, runningMode: 'VIDEO', numPoses: 1
    }),
  segment: () =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: segmentModel, ...VIDEO },
      runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false
    })
}

export interface Mask { data: Uint8Array; width: number; height: number }
export interface TrackResults { face?: FaceResult; hands?: HandsResult; pose?: PoseResult; mask?: Mask }

// MediaPipe assumes a mirrored selfie image; we feed un-mirrored frames, so swap.
const unmirror = (label: string | undefined): 'Left' | 'Right' => (label === 'Left' ? 'Right' : 'Left')

export class Trackers {
  private ready = new Map<Kind, Task>()
  private loading = new Set<Kind>()
  private wanted = new Set<Kind>()
  private canvas = new OffscreenCanvas(TRACK_W, 360)
  private ctx = this.canvas.getContext('2d', { willReadFrequently: false })!
  private lastTs = 0

  constructor(
    private onError: (e: Error) => void,
    private onLoading: (needs: Need[]) => void = () => {} // drives the UI's loading shimmer
  ) {}

  /** Set which trackers should exist. Loads missing ones in the background, closes extras. */
  want(needs: Iterable<Need>): void {
    const w = new Set<Kind>(needs)
    if (w.has('gestures')) w.delete('hands') // GestureRecognizer also gives landmarks + handedness
    this.wanted = w
    for (const [k, t] of this.ready) if (!w.has(k)) { t.close(); this.ready.delete(k) }
    for (const k of w) if (!this.ready.has(k) && !this.loading.has(k)) this.start(k)
  }

  private start(k: Kind): void {
    this.loading.add(k)
    this.onLoading([...this.loading])
    load[k]()
      .then((t) => (this.wanted.has(k) ? this.ready.set(k, t) : t.close()))
      .catch((e) => this.onError(new Error(`Could not load ${k} tracker: ${e?.message ?? e}`, { cause: e })))
      .finally(() => {
        this.loading.delete(k)
        this.onLoading([...this.loading])
      })
  }

  run(frame: VideoFrame): TrackResults {
    if (this.ready.size === 0) return {}
    const h = Math.round((TRACK_W * frame.displayHeight) / frame.displayWidth)
    if (this.canvas.height !== h) this.canvas.height = h
    this.ctx.drawImage(frame, 0, 0, TRACK_W, h)
    const src = this.canvas
    const ts = (this.lastTs = Math.max(this.lastTs + 1, performance.now()))
    const out: TrackResults = {}

    const face = this.ready.get('face') as FaceLandmarker | undefined
    if (face) {
      const r = face.detectForVideo(src, ts)
      out.face = {
        faces: r.faceLandmarks, // NormalizedLandmark is structurally a Pt (+ visibility)
        blendshapes: (r.faceBlendshapes ?? []).map((c) =>
          Object.fromEntries(c.categories.map((x) => [x.categoryName, x.score])))
      }
    }
    const gest = this.ready.get('gestures') as GestureRecognizer | undefined
    const hand = this.ready.get('hands') as HandLandmarker | undefined
    if (gest) {
      const r = gest.recognizeForVideo(src, ts)
      out.hands = {
        hands: r.landmarks,
        handedness: r.handedness.map((c) => unmirror(c[0]?.categoryName)),
        gestures: r.gestures.map((c) => c[0]?.categoryName ?? 'None')
      }
    } else if (hand) {
      const r = hand.detectForVideo(src, ts)
      out.hands = { hands: r.landmarks, handedness: r.handedness.map((c) => unmirror(c[0]?.categoryName)), gestures: [] }
    }
    const pose = this.ready.get('pose') as PoseLandmarker | undefined
    if (pose) out.pose = { poses: pose.detectForVideo(src, ts).landmarks }

    const seg = this.ready.get('segment') as ImageSegmenter | undefined
    if (seg) {
      // Masks are only valid inside the callback, and live in MediaPipe's own GL context: copy out.
      seg.segmentForVideo(src, ts, (r) => {
        const m = r.confidenceMasks?.[0]
        if (!m) return
        const f = m.getAsFloat32Array()
        const data = new Uint8Array(f.length)
        for (let i = 0; i < f.length; i++) data[i] = f[i] * 255
        out.mask = { data, width: m.width, height: m.height }
      })
    }
    return out
  }

  close(): void {
    this.want([])
  }
}
