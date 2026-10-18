// The one place the UI gets its engine, filters and presets from.
import { createEngine } from '@engine/engine'
import { createAdaptiveEngine } from './engine-adapter'

export { filters } from '@filters/index'
export { presets } from '../../presets/presets'

export const engine = createAdaptiveEngine(async () => {
  const s = await window.camtoys.settings.get()
  return { width: s.width, height: s.height, fps: s.fps }
}, createEngine)

// Not in the frozen contract: fires with the tracker models still loading ([] = all ready).
export const onLoading = engine.onLoading
