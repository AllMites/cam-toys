// The one place the UI gets its engine, filters and presets from.
// Phase 6: point these imports at the real engine (src/engine), the real registry
// (@filters/index) and the real presets file. Nothing else in src/renderer changes.
import type { Need } from '@engine/types'
import { mockEngine } from './mock/engine'

export { filters } from './mock/filters'
export { presets } from './mock/presets'
export const engine = mockEngine

// Not in the frozen contract: fires with the tracker models still loading ([] = all ready).
// Drives the shimmer. If the real engine lacks it, export `() => () => {}` instead.
export const onLoading: (cb: (needs: Need[]) => void) => () => void = mockEngine.onLoading
