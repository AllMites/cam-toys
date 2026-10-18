<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import Icon from './Icon.svelte'
  import ParamControl from './ParamControl.svelte'
  import { app, byId, removeLayer, moveLayer, clearLayers } from '../state/app.svelte'

  // Shown newest-on-top (like a real stack); app.layers is render order, so index is flipped.
  const shown = $derived([...app.layers].reverse())
  const toStack = (i: number) => app.layers.length - 1 - i

  let dragFrom = $state(-1)
  let dragOver = $state(-1)
  let armed = $state(-1) // only the grip starts a drag, so sliders inside cards still work

  function drop(i: number) {
    if (dragFrom >= 0) moveLayer(toStack(dragFrom), toStack(i))
    dragFrom = dragOver = -1
  }
  function keys(e: KeyboardEvent, i: number) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const to = e.key === 'ArrowUp' ? i - 1 : i + 1
    moveLayer(toStack(i), toStack(to))
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('.card .grip')[to]?.focus())
  }
  const loadingFor = (id: string) => byId.get(id)?.needs.some((n) => app.loading.includes(n))
</script>

<aside class="drawer glass" data-tour="layers" aria-label="Layers">
  <header>
    <h2>Layers <span class="count">{app.layers.length}</span></h2>
    {#if app.layers.length}
      <button class="btn ghost small" onclick={clearLayers}><Icon name="trash" size={14} />Clear</button>
    {/if}
  </header>

  {#if !app.layers.length}
    <div class="empty">
      <div class="stackart" aria-hidden="true"><span>🐻</span><span>📼</span><span>✨</span></div>
      <h3>Nothing stacked yet</h3>
      <p>Tap a bubble below to add a filter. Add more and they stack on top of each other.</p>
    </div>
  {:else}
    <ol class="list">
      {#each shown as layer, i (layer.uid)}
        {@const def = byId.get(layer.filterId)}
        <li class="card" class:off={!layer.enabled} class:dragging={dragFrom === i} class:over={dragOver === i && dragFrom !== i}
          animate:flip={{ duration: 250 }} in:fly={{ y: -12, duration: 250 }}
          draggable={armed === i}
          ondragstart={(e) => { dragFrom = i; e.dataTransfer?.setData('text/plain', layer.uid) }}
          ondragover={(e) => { e.preventDefault(); dragOver = i }}
          ondragleave={() => { if (dragOver === i) dragOver = -1 }}
          ondrop={(e) => { e.preventDefault(); drop(i) }}
          ondragend={() => (dragFrom = dragOver = armed = -1)}>
          <div class="head">
            <button class="grip" onpointerdown={() => (armed = i)} onpointerup={() => (armed = -1)} aria-label="Move {def?.name}. Alt+Up or Alt+Down to reorder" onkeydown={(e) => keys(e, i)}>
              <Icon name="grip" size={16} />
            </button>
            <span class="icon" class:shimmer={loadingFor(layer.filterId)}>{def?.icon}</span>
            <span class="title">{def?.name ?? layer.filterId}{#if def?.cost === 'heavy'}<span class="bolt" title="Heavy filter">⚡</span>{/if}</span>
            <button class="icon-btn sm" onclick={() => (layer.enabled = !layer.enabled)}
              aria-label={layer.enabled ? `Hide ${def?.name}` : `Show ${def?.name}`} aria-pressed={!layer.enabled}>
              <Icon name={layer.enabled ? 'eye' : 'eyeOff'} size={16} />
            </button>
            <button class="icon-btn sm" onclick={() => removeLayer(layer.uid)} aria-label="Remove {def?.name}">
              <Icon name="x" size={16} />
            </button>
          </div>
          {#if def && Object.keys(def.params).length && layer.enabled}
            <div class="params">
              {#each Object.entries(def.params) as [id, param] (id)}
                <ParamControl {id} {param} values={layer.params} />
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    <p class="foot">Top layer is drawn last. Drag to reorder.</p>
  {/if}
</aside>

<style>
  .drawer {
    grid-area: drawer; margin: 8px 16px 18px 0; border-radius: var(--r-xl);
    display: flex; flex-direction: column; min-height: 0; overflow: hidden;
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 12px 20px; }
  h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .count { font-size: 12px; font-weight: 600; color: var(--muted); background: var(--panel-2); padding: 1px 8px; border-radius: 999px; }
  .small { height: 28px; padding: 0 10px; font-size: 12.5px; }

  .list { list-style: none; margin: 0; padding: 0 12px 12px; display: grid; gap: 8px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
  .card {
    background: rgba(15, 15, 18, 0.55); border: 1px solid var(--hairline); border-radius: var(--r-lg);
    padding: 8px 8px 8px 4px; transition: opacity 0.2s, border-color 0.15s, box-shadow 0.15s;
  }
  .card.off { opacity: 0.55; }
  .card.dragging { opacity: 0.4; }
  .card.over { border-color: var(--purple); box-shadow: 0 0 0 1px var(--purple); }
  .head { display: flex; align-items: center; gap: 6px; }
  .grip { color: var(--faint); cursor: grab; padding: 6px 2px; border-radius: 6px; display: grid; }
  .grip:hover { color: var(--text); }
  .icon { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 18px; background-color: var(--panel-2); flex: none; }
  .title { flex: 1; font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }
  .bolt { font-size: 12px; }
  .sm { width: 30px; height: 30px; }
  .params { display: grid; gap: 6px; padding: 10px 6px 4px 30px; }
  .foot { font-size: 12px; color: var(--faint); text-align: center; padding: 0 0 14px; margin-top: auto; }

  .empty { flex: 1; display: grid; place-content: center; justify-items: center; text-align: center; gap: 8px; padding: 24px 32px 60px; }
  .empty h3 { font-size: 15px; font-weight: 700; margin-top: 8px; }
  .empty p { color: var(--muted); font-size: 13px; max-width: 220px; }
  .stackart { position: relative; width: 120px; height: 64px; }
  .stackart span {
    position: absolute; top: 4px; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center;
    font-size: 24px; background: var(--panel-2); border: 3px solid var(--panel);
  }
  .stackart span:nth-child(1) { left: 0; rotate: -8deg; }
  .stackart span:nth-child(2) { left: 32px; z-index: 1; top: 0; background: #2a2635; }
  .stackart span:nth-child(3) { left: 64px; rotate: 8deg; }
</style>
