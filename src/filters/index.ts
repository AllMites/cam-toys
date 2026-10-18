import type { FilterDef } from '@engine/types'

// Every src/filters/<category>/<id>.ts default-exports a FilterDef; picked up automatically.
const mods = import.meta.glob<{ default: FilterDef }>(['./*/*.ts', '!./*/_*.ts', '!./*/*.test.ts'], { eager: true })
export const filters: FilterDef[] = Object.values(mods).map((m) => m.default)
