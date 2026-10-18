<script lang="ts">
  import type { Category, FilterDef, Need, Preset } from '@engine/types'
  import { app, byId, filters, presets, inStack, tapFilter, tapPreset, randomize } from '../state/app.svelte'

  const TABS: [Category, string][] = [
    ['featured', 'Featured'], ['face', 'Face'], ['eyes', 'Eyes'], ['hands', 'Hands'], ['body', 'Body'],
    ['background', 'Background'], ['color', 'Color'], ['retro', 'Retro'], ['art', 'Art']
  ]
  const NEEDS: Record<Need, string> = { face: 'your face', hands: 'your hands', gestures: 'hand gestures', pose: 'your body', segment: 'you vs. background' }

  type Item = { key: string; icon: string; name: string; heavy: boolean; needs: Need[]; hint: string; on: boolean; tap: () => void }

  const fromFilter = (f: FilterDef): Item => ({
    key: f.id, icon: f.icon, name: f.name, heavy: f.cost === 'heavy', needs: f.needs, hint: f.hint,
    on: inStack(f.id), tap: () => tapFilter(f)
  })
  const fromPreset = (p: Preset): Item => {
    const defs = p.layers.map((l) => byId.get(l.filterId)).filter((d): d is FilterDef => !!d)
    return {
      key: p.id, icon: p.icon, name: p.name, heavy: defs.some((d) => d.cost === 'heavy'),
      needs: [...new Set(defs.flatMap((d) => d.needs))],
      hint: defs.length ? defs.map((d) => d.name).join(' + ') + '.' : 'No filters, just you.',
      on: app.activePreset === p.id, tap: () => tapPreset(p)
    }
  }

  const items = $derived(app.tab === 'featured' ? presets.map(fromPreset) : filters.filter((f) => f.category === app.tab).map(fromFilter))

  let scroller: HTMLDivElement
  let tipTimer = 0
  function showTip(e: Event, it: Item) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    clearTimeout(tipTimer)
    tipTimer = window.setTimeout(() => {
      const needs = it.needs.length ? `Tracks ${it.needs.map((n) => NEEDS[n]).join(', ')}.` : ''
      const heavy = it.heavy ? ' ⚡ Heavy: may slow down laptops.' : ''
      app.tip = { title: it.name, text: `${it.hint} ${needs}${heavy}`.trim(), x: r.left + r.width / 2, y: r.top }
    }, 350)
  }
  function hideTip() { clearTimeout(tipTimer); app.tip = null }

  function wheel(e: WheelEvent) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { scroller.scrollLeft += e.deltaY; e.preventDefault() }
  }
  function pickTab(t: Category) { app.tab = t; hideTip(); scroller?.scrollTo({ left: 0 }) }
  const loadingFor = (it: Item) => it.on && it.needs.some((n) => app.loading.includes(n))
</script>

<section class="dock">
  <div class="tabs-row">
    <div class="tabs" role="tablist" aria-label="Filter categories" onwheel={(e) => { e.currentTarget.scrollLeft += e.deltaY }}>
      {#each TABS as [id, label] (id)}
        <button role="tab" aria-selected={app.tab === id} onclick={() => pickTab(id)}>{label}</button>
      {/each}
    </div>
    <button class="btn surprise" onclick={randomize} title="Random filter combo" aria-label="Surprise me"><span aria-hidden="true">🎲</span><span class="label">Surprise me</span></button>
  </div>

  <div class="scroller" bind:this={scroller} onwheel={wheel} onscroll={hideTip} data-tour="carousel" role="tabpanel">
    {#each items as it (it.key)}
      <button class="bubble" class:on={it.on} aria-pressed={it.on} onclick={it.tap}
        onmouseenter={(e) => showTip(e, it)} onmouseleave={hideTip} onfocus={(e) => showTip(e, it)} onblur={hideTip}>
        <span class="ring">
          <span class="face" class:shimmer={loadingFor(it)}>{it.icon}</span>
          {#if it.heavy}<span class="bolt" aria-label="Heavy filter">⚡</span>{/if}
        </span>
        <span class="name">{it.name}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .dock { grid-area: dock; padding: 14px 24px 18px; min-width: 0; }
  .tabs-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .tabs { display: flex; gap: 2px; padding: 4px; border-radius: 999px; background: var(--panel-glass); border: 1px solid var(--hairline); backdrop-filter: var(--blur); overflow-x: auto; scrollbar-width: none; min-width: 0; }
  .tabs button { height: 30px; padding: 0 14px; border-radius: 999px; font-weight: 600; font-size: 13px; color: var(--muted); white-space: nowrap; transition: color 0.15s, background 0.2s; }
  .tabs button:hover { color: var(--text); }
  .tabs button[aria-selected='true'] { background: var(--text); color: var(--bg); }
  .surprise { height: 38px; flex: none; }
  @media (max-width: 1100px) { .surprise { width: 38px; padding: 0; } .surprise .label { display: none; } }

  .scroller {
    display: flex; gap: 6px; overflow-x: auto; padding: 14px 8px 4px; margin-top: 4px;
    scroll-snap-type: x proximity; scrollbar-width: none; justify-content: safe center;
    mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
  }
  .bubble { flex: none; width: 84px; display: grid; justify-items: center; gap: 8px; scroll-snap-align: center; }
  .ring {
    position: relative; width: 68px; height: 68px; border-radius: 50%; padding: 3px;
    background: var(--border); transition: transform 0.35s var(--spring), background 0.2s, box-shadow 0.3s;
  }
  .bubble:hover .ring { transform: translateY(-3px) scale(1.04); }
  .bubble:active .ring { transform: scale(0.92); transition-duration: 0.1s; }
  .bubble.on .ring { background: var(--grad); box-shadow: 0 8px 24px rgba(236, 72, 153, 0.3); animation: boing 0.5s var(--spring); }
  .face {
    width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center;
    font-size: 30px; background-color: var(--panel-2); border: 3px solid var(--bg); line-height: 1;
  }
  .bubble.on .face { background-color: #26232f; }
  .bolt {
    position: absolute; top: -2px; right: -4px; width: 22px; height: 22px; border-radius: 50%;
    display: grid; place-items: center; font-size: 12px; background: var(--bg); border: 2px solid var(--amber);
  }
  .name { font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; max-width: 84px; overflow: hidden; text-overflow: ellipsis; }
  .bubble.on .name { color: var(--text); }
  .bubble:focus-visible { outline: none; }
  .bubble:focus-visible .ring { box-shadow: 0 0 0 3px var(--bg), 0 0 0 5px var(--purple); }
  @keyframes boing { 0% { transform: scale(1); } 35% { transform: scale(0.88); } 70% { transform: scale(1.08); } 100% { transform: scale(1); } }
</style>
