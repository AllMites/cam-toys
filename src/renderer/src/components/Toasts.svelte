<script lang="ts">
  import { flip } from 'svelte/animate'
  import { fly } from 'svelte/transition'
  import { app, dismissToast } from '../state/app.svelte'
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each app.toasts as t (t.id)}
    <button class="toast glass" animate:flip={{ duration: 200 }} in:fly={{ y: -16, duration: 280 }} out:fly={{ y: -8, duration: 180 }}
      onclick={() => dismissToast(t.id)} aria-label="{t.text} (dismiss)">
      <span class="i">{t.icon}</span>{t.text}
    </button>
  {/each}
</div>

<style>
  .toasts { position: fixed; top: 72px; left: 50%; translate: -50% 0; z-index: 40; display: grid; gap: 8px; justify-items: center; pointer-events: none; }
  .toast {
    pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 10px 16px 10px 12px;
    border-radius: 999px; font-weight: 500; font-size: 13.5px; white-space: nowrap; background: rgba(34, 34, 42, 0.9);
  }
  .i { font-size: 18px; line-height: 1; }
</style>
