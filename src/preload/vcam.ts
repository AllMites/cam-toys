import type { VcamApi } from '../engine/types'

// Phase 2 replaces this with the Softcam/koffi bridge.
export const vcam: VcamApi = {
  available: () => false,
  start: () => false,
  send: () => {},
  stop: () => {}
}
