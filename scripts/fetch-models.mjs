// Downloads the MediaPipe models into resources/models/ from Google's official bucket.
// The files are committed (offline dev, reproducible builds, no install-time network).
// Run again only to update them: `npm run models` (add --force to overwrite).
import { mkdir, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

const base = 'https://storage.googleapis.com/mediapipe-models'
const models = {
  'face_landmarker.task': `${base}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
  'hand_landmarker.task': `${base}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
  'gesture_recognizer.task': `${base}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`,
  'pose_landmarker_lite.task': `${base}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
  'selfie_segmenter_landscape.tflite': `${base}/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite`
}

const dir = join(import.meta.dirname, '..', 'resources', 'models')
const force = process.argv.includes('--force')
await mkdir(dir, { recursive: true })

for (const [name, url] of Object.entries(models)) {
  const file = join(dir, name)
  if (!force && (await access(file).then(() => true, () => false))) continue
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} from ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(file, buf)
  console.log(`${name} ${(buf.length / 1e6).toFixed(1)} MB`)
}
