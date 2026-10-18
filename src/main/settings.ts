import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Settings } from '../engine/types'

export const DEFAULTS: Settings = {
  cameraId: null, width: 1280, height: 720, fps: 30,
  lastLayers: [], tutorialDone: false, closeToTray: true,
  hotkeys: { next: 'Control+Alt+Right', prev: 'Control+Alt+Left' }
}

// Shallow-merge onto defaults so new keys appear and unknown junk is ignored.
export function merge(raw: unknown): Settings {
  const out = structuredClone(DEFAULTS) as unknown as Record<string, unknown>
  if (!raw || typeof raw !== 'object') return out as unknown as Settings
  for (const k of Object.keys(DEFAULTS)) if (k in raw) out[k] = (raw as Record<string, unknown>)[k]
  return out as unknown as Settings
}

export function load(file: string): Settings {
  try {
    return merge(JSON.parse(readFileSync(file, 'utf8')))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('[settings] unreadable, using defaults', err)
    return structuredClone(DEFAULTS)
  }
}

export function save(file: string, s: Settings): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(s, null, 2))
}
