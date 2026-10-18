/// <reference types="svelte" />
/// <reference types="vite/client" />
import type { CamtoysApi } from '@engine/types'

declare global {
  interface Window { camtoys: CamtoysApi }
}
