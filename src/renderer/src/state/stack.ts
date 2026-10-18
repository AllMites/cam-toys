import type { FilterDef, Layer, ParamValues, Preset } from '@engine/types'

// Pure layer-stack operations. Stack order = render order (index 0 is applied first).

let n = 0
export const uid = () => `l${Date.now().toString(36)}${(n++).toString(36)}`

export function defaults(def: FilterDef): ParamValues {
  return Object.fromEntries(Object.entries(def.params).map(([k, p]) => [k, p.default]))
}

export function makeLayer(def: FilterDef, params: ParamValues = {}): Layer {
  return { uid: uid(), filterId: def.id, enabled: true, params: { ...defaults(def), ...params } }
}

// Unknown filter ids (e.g. a preset from a newer build) are dropped, not crashed on.
export function fromSaved(saved: Omit<Layer, 'uid'>[], byId: Map<string, FilterDef>): Layer[] {
  return saved.flatMap((s) => {
    const def = byId.get(s.filterId)
    return def ? [{ ...makeLayer(def, s.params), enabled: s.enabled }] : []
  })
}

export const applyPreset = (p: Preset, byId: Map<string, FilterDef>) => fromSaved(p.layers, byId)

export const toSaved = (layers: Layer[]): Omit<Layer, 'uid'>[] =>
  layers.map(({ filterId, enabled, params }) => ({ filterId, enabled, params }))

export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const out = [...list]
  out.splice(to, 0, out.splice(from, 1)[0])
  return out
}

// One face/eyes toy plus one look on top. Never heavy, so it never needs the ⚡ dialog.
export function randomStack(all: FilterDef[], rnd = Math.random): Layer[] {
  const pick = (cats: string[]) => {
    const pool = all.filter((f) => cats.includes(f.category) && f.cost !== 'heavy')
    return pool[Math.floor(rnd() * pool.length)]
  }
  const picks = [pick(['face', 'eyes']), pick(['color', 'retro', 'art'])]
  if (rnd() < 0.5) picks.push(pick(['hands', 'background']))
  return picks.filter(Boolean).map((d) => makeLayer(d))
}
