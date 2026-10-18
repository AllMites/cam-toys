<script lang="ts">
  import type { Param, ParamValues } from '@engine/types'
  // One control per Param variant. Writes straight into the layer's params ($state proxy).
  let { id, param, values }: { id: string; param: Param; values: ParamValues } = $props()
  const uid = $props.id()

  const pct = $derived(param.type === 'range' ? ((Number(values[id]) - param.min) / (param.max - param.min)) * 100 : 0)
  const shown = (v: number, step = 0.01) => (step >= 1 ? String(v) : `${Math.round(v * 100)}%`)
</script>

<div class="row" class:stack={param.type === 'range'}>
  <label for={uid}>{param.label}</label>
  {#if param.type === 'range'}
    <span class="val">{shown(Number(values[id]), param.step)}</span>
    <input id={uid} type="range" min={param.min} max={param.max} step={param.step ?? 0.01}
      style:--p="{pct}%" value={values[id]} oninput={(e) => (values[id] = e.currentTarget.valueAsNumber)} />
  {:else if param.type === 'color'}
    <span class="color">
      <span class="hex">{String(values[id]).toUpperCase()}</span>
      <input id={uid} type="color" value={values[id]} oninput={(e) => (values[id] = e.currentTarget.value)} />
    </span>
  {:else if param.type === 'select'}
    {#if param.options.length <= 3}
      <div class="seg" role="group" aria-labelledby={uid} id={uid}>
        {#each param.options as o (o)}
          <button aria-pressed={values[id] === o} onclick={() => (values[id] = o)}>{o}</button>
        {/each}
      </div>
    {:else}
      <select id={uid} class="field" value={values[id]} onchange={(e) => (values[id] = e.currentTarget.value)}>
        {#each param.options as o (o)}<option>{o}</option>{/each}
      </select>
    {/if}
  {:else}
    <input id={uid} type="checkbox" role="switch" class="switch" checked={Boolean(values[id])}
      onchange={(e) => (values[id] = e.currentTarget.checked)} />
  {/if}
</div>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; }
  .row.stack { display: grid; grid-template-columns: 1fr auto; row-gap: 4px; }
  .row.stack input { grid-column: 1 / -1; }
  label { font-size: 13px; color: var(--muted); }
  .val { font-size: 12px; color: var(--faint); font-variant-numeric: tabular-nums; }
  .field { height: 30px; font-size: 13px; }
  .seg button { height: 24px; padding: 0 10px; font-size: 12px; }

  input[type='range'] {
    appearance: none; width: 100%; height: 18px; background: transparent; margin: 0; cursor: pointer;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 4px; border-radius: 999px;
    background: linear-gradient(90deg, var(--purple), var(--pink)) 0 / var(--p) 100% no-repeat, var(--border);
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5); transition: transform 0.2s var(--spring);
  }
  input[type='range']:active::-webkit-slider-thumb { transform: scale(1.2); }

  .color { display: flex; align-items: center; gap: 8px; }
  .hex { font-size: 12px; color: var(--faint); font-variant-numeric: tabular-nums; }
  input[type='color'] {
    appearance: none; width: 28px; height: 28px; padding: 0; border: 2px solid var(--border);
    border-radius: 50%; background: none; cursor: pointer; overflow: hidden;
  }
  input[type='color']::-webkit-color-swatch-wrapper { padding: 0; }
  input[type='color']::-webkit-color-swatch { border: 0; border-radius: 50%; }
</style>
