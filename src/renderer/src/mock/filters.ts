import type { Cost, FilterDef, Need, Param } from '@engine/types'

// Metadata-only stand-in for the Phase 5 filter pack. create() is a no-op; the mock
// engine just prints layer names. PRD "Expressions" live in face, "Motion" in art,
// since Category has no such members.

type Def = Omit<FilterDef, 'create'>
const noop: FilterDef['create'] = () => ({ render() {}, dispose() {} })

const range = (label: string, d: number, min = 0, max = 1, step = 0.01): Param => ({ type: 'range', label, min, max, step, default: d })
const color = (label: string, d: string): Param => ({ type: 'color', label, default: d })
const select = (label: string, options: string[], d = options[0]): Param => ({ type: 'select', label, options, default: d })
const toggle = (label: string, d: boolean): Param => ({ type: 'toggle', label, default: d })

const face: Need[] = ['face']
const seg: Need[] = ['segment']
const M: Cost = 'medium'
const L: Cost = 'light'

const defs: Def[] = [
  // face
  { id: 'bear', name: 'Bear', category: 'face', icon: '🐻', cost: M, needs: face, hint: 'Fluffy ears, a button nose and rosy cheeks.', params: { blush: toggle('Blush', true), smooth: range('Soft skin', 0.4) } },
  { id: 'puppy', name: 'Puppy', category: 'face', icon: '🐶', cost: M, needs: face, hint: 'Open your mouth and the tongue comes out!', params: { tongue: toggle('Tongue', true) } },
  { id: 'cat', name: 'Cat', category: 'face', icon: '🐱', cost: M, needs: face, hint: 'Pointy ears and whiskers.', params: { fur: color('Fur', '#f2a65a'), whiskers: toggle('Whiskers', true) } },
  { id: 'bunny', name: 'Bunny', category: 'face', icon: '🐰', cost: M, needs: face, hint: 'Long floppy ears follow your head.', params: { size: range('Ear size', 0.6) } },
  { id: 'flower-crown', name: 'Flower crown', category: 'face', icon: '🌸', cost: M, needs: face, hint: 'A crown of flowers that sits on your head.', params: { style: select('Flowers', ['Roses', 'Daisies', 'Sunflowers']) } },
  { id: 'sunglasses', name: 'Deal with it', category: 'face', icon: '😎', cost: M, needs: face, hint: 'Smile and the shades drop in.', params: { trigger: select('Show', ['On smile', 'Always']) } },
  { id: 'party-hat', name: 'Party hat', category: 'face', icon: '🥳', cost: M, needs: face, hint: 'Open your mouth for a confetti blast.', params: { confetti: range('Confetti', 0.7) } },
  { id: 'big-head', name: 'Big head', category: 'face', icon: '🎈', cost: M, needs: face, hint: 'Make your head huge, or your face tiny.', params: { mode: select('Mode', ['Big head', 'Tiny face']), amount: range('Amount', 0.5) } },
  { id: 'face-mesh', name: 'Face mesh', category: 'face', icon: '🕸️', cost: M, needs: face, hint: 'A techy wireframe over your face.', params: { color: color('Color', '#8b5cf6'), opacity: range('Opacity', 0.8) } },
  { id: 'beauty', name: 'Beauty', category: 'face', icon: '✨', cost: M, needs: face, hint: 'Smooths skin and brightens your face.', params: { smooth: range('Smooth', 0.5), brighten: range('Brighten', 0.3) } },
  { id: 'rainbow-puke', name: 'Rainbow puke', category: 'face', icon: '🤮', cost: M, needs: face, hint: 'Open your mouth wide. Rainbows come out.', params: { amount: range('Amount', 0.8) } },
  { id: 'fire-breath', name: 'Fire breath', category: 'face', icon: '🐉', cost: M, needs: face, hint: 'Open your mouth to breathe fire.', params: { amount: range('Flames', 0.8) } },
  { id: 'blink-flash', name: 'Blink flash', category: 'face', icon: '📸', cost: M, needs: face, hint: 'Blink to fire a camera flash.', params: { effect: select('Effect', ['Flash', 'Glitch']) } },
  // eyes
  { id: 'laser-eyes', name: 'Laser eyes', category: 'eyes', icon: '🔴', cost: M, needs: face, hint: 'Open your eyes wide to fire lasers.', params: { color: color('Color', '#ff2d55'), length: range('Length', 0.7) } },
  { id: 'glowing-eyes', name: 'Glowing eyes', category: 'eyes', icon: '👁️', cost: M, needs: face, hint: 'Your eyes glow in any color.', params: { color: color('Color', '#22d3ee'), glow: range('Glow', 0.6) } },
  { id: 'anime-eyes', name: 'Anime eyes', category: 'eyes', icon: '🥺', cost: M, needs: face, hint: 'Big sparkly anime eyes.', params: { size: range('Size', 0.5) } },
  { id: 'iris-color', name: 'Iris color', category: 'eyes', icon: '🔵', cost: M, needs: face, hint: 'Change your eye color.', params: { color: color('Color', '#3b82f6') } },
  // hands
  { id: 'finger-paint', name: 'Finger paint', category: 'hands', icon: '🖌️', cost: M, needs: ['hands'], hint: 'Pinch to start or stop drawing with your finger.', params: { color: color('Color', '#ec4899'), width: range('Brush', 0.4), fade: toggle('Fade strokes', true) } },
  { id: 'particle-hands', name: 'Sparkle hands', category: 'hands', icon: '🎇', cost: M, needs: ['hands'], hint: 'Sparkles fly from your fingertips.', params: { amount: range('Sparkles', 0.6) } },
  { id: 'gesture-fx', name: 'Gesture FX', category: 'hands', icon: '✌️', cost: M, needs: ['hands', 'gestures'], hint: '✌️ hearts · 👍 stars · 🤘 lightning · ✋ freeze', params: { size: range('Size', 0.6) } },
  { id: 'hand-skeleton', name: 'Hand bones', category: 'hands', icon: '🖐️', cost: M, needs: ['hands'], hint: 'Shows the bones of your hands.', params: { color: color('Color', '#22d3ee') } },
  // body
  { id: 'skeleton', name: 'Skeleton', category: 'body', icon: '💀', cost: M, needs: ['pose'], hint: 'A glowing stick figure follows your body.', params: { color: color('Color', '#a3e635') } },
  { id: 'ghost-trails', name: 'Ghost trails', category: 'body', icon: '👻', cost: 'heavy', needs: seg, hint: 'Move around to leave ghost copies of yourself.', params: { length: range('Trail', 0.5) } },
  { id: 'neon-outline', name: 'Neon outline', category: 'body', icon: '💜', cost: 'heavy', needs: seg, hint: 'A neon glow around your silhouette.', params: { color: color('Color', '#8b5cf6'), glow: range('Glow', 0.7) } },
  // background
  { id: 'bg-blur', name: 'Blur', category: 'background', icon: '🌫️', cost: M, needs: seg, hint: 'Blurs everything behind you.', params: { amount: range('Blur', 0.6) } },
  { id: 'bg-replace', name: 'New place', category: 'background', icon: '🏝️', cost: M, needs: seg, hint: 'Swap your background for a new scene.', params: { scene: select('Scene', ['Space', 'Beach', 'Office', 'Gradient']) } },
  { id: 'bg-color', name: 'Solid color', category: 'background', icon: '🟩', cost: M, needs: seg, hint: 'Replaces your background with one color.', params: { color: color('Color', '#00b140') } },
  // color
  { id: 'lut', name: 'Color grade', category: 'color', icon: '🎨', cost: L, needs: [], hint: 'Film-style color looks.', params: { grade: select('Look', ['Warm', 'Cool', 'Teal-Orange', 'B&W', 'Sepia', 'Pastel', 'Cyberpunk']), strength: range('Strength', 1) } },
  { id: 'thermal', name: 'Thermal', category: 'color', icon: '🌡️', cost: L, needs: [], hint: 'See yourself like a heat camera.', params: {} },
  { id: 'night-vision', name: 'Night vision', category: 'color', icon: '🌙', cost: L, needs: [], hint: 'Green night-vision goggles.', params: { noise: range('Noise', 0.4) } },
  // retro
  { id: 'vhs', name: 'VHS', category: 'retro', icon: '📼', cost: L, needs: [], hint: 'Wobbly old tape with color bleed.', params: { tracking: range('Tracking', 0.4), bleed: range('Color bleed', 0.5) } },
  { id: 'crt', name: 'CRT', category: 'retro', icon: '📺', cost: L, needs: [], hint: 'Scanlines and a curved old TV screen.', params: { curve: range('Curve', 0.4), scanlines: range('Scanlines', 0.6) } },
  { id: 'glitch', name: 'Glitch', category: 'retro', icon: '👾', cost: L, needs: [], hint: 'Random digital glitches.', params: { amount: range('Amount', 0.5) } },
  { id: 'pixelate', name: '8-bit', category: 'retro', icon: '🕹️', cost: L, needs: [], hint: 'Chunky pixels like an old game.', params: { size: range('Pixel size', 8, 2, 32, 1), palette: toggle('8-bit colors', true) } },
  { id: 'ascii', name: 'ASCII', category: 'retro', icon: '🔤', cost: L, needs: [], hint: 'You, made of text characters.', params: { size: range('Size', 10, 6, 24, 1), colors: select('Colors', ['Green', 'White', 'Full color']) } },
  // art
  { id: 'comic', name: 'Comic', category: 'art', icon: '💥', cost: L, needs: [], hint: 'Bold outlines and flat cartoon colors.', params: { edges: range('Outlines', 0.6), levels: range('Colors', 5, 2, 10, 1) } },
  { id: 'kaleidoscope', name: 'Kaleidoscope', category: 'art', icon: '🔮', cost: L, needs: [], hint: 'Mirrored slices spinning around the center.', params: { segments: range('Slices', 6, 3, 12, 1) } },
  { id: 'mirror', name: 'Mirror', category: 'art', icon: '🪞', cost: L, needs: [], hint: 'Mirror one half of the picture.', params: { mode: select('Mode', ['Left', 'Right', 'Quad']) } },
  { id: 'chromatic', name: 'Chromatic', category: 'art', icon: '🌈', cost: L, needs: [], hint: 'Splits the red, green and blue edges apart.', params: { amount: range('Amount', 0.4) } },
  { id: 'film-grain', name: 'Film grain', category: 'art', icon: '🎬', cost: L, needs: [], hint: 'Grain and dark corners like old film.', params: { grain: range('Grain', 0.4), vignette: range('Vignette', 0.5) } },
  { id: 'motion-trails', name: 'Time echo', category: 'art', icon: '💫', cost: L, needs: [], hint: 'Move fast to leave echoes behind.', params: { length: range('Echo', 0.5) } }
]

export const filters: FilterDef[] = defs.map((d) => ({ ...d, create: noop }))
