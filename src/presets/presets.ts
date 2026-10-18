import type { Preset } from '../engine/types'

// PRD Featured row, in order. Params not listed fall back to the filter's defaults.
// Pure data: imported by the renderer and the main process (tray menu).
const l = (filterId: string, params = {}) => ({ filterId, enabled: true, params })

export const presets: Preset[] = [
  { id: 'p-bear', name: 'Bear', icon: '🐻', layers: [l('bear')] },
  { id: 'p-puppy', name: 'Puppy', icon: '🐶', layers: [l('puppy')] },
  { id: 'p-cozy', name: 'Cozy', icon: '☕', layers: [l('beauty'), l('lut', { grade: 'Warm' }), l('blur')] },
  { id: 'p-laser', name: 'Laser Eyes', icon: '🔴', layers: [l('laser-eyes')] },
  { id: 'p-anime', name: 'Anime', icon: '🥺', layers: [l('anime-eyes'), l('lut', { grade: 'Pastel' })] },
  { id: 'p-vhs', name: 'VHS Night', icon: '📼', layers: [l('vhs'), l('grain-vignette')] },
  { id: 'p-cyber', name: 'Cyberpunk', icon: '🌃', layers: [l('neon-outline'), l('lut', { grade: 'Cyberpunk' }), l('chromatic')] },
  { id: 'p-space', name: 'Space Office', icon: '🪐', layers: [l('replace', { scene: 'Space' })] },
  { id: 'p-paint', name: 'Finger Paint', icon: '🖌️', layers: [l('finger-paint')] },
  { id: 'p-clean', name: 'Clean', icon: '⭕', layers: [] }
]
