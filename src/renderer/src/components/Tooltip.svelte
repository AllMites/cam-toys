<script lang="ts">
  import { app } from '../state/app.svelte'
  // Fixed-position so the carousel's overflow doesn't clip it.
  const x = $derived(app.tip ? Math.min(Math.max(app.tip.x, 150), innerWidth - 150) : 0)
</script>

{#if app.tip}
  <div class="tip glass" role="tooltip" style:left="{x}px" style:top="{app.tip.y - 12}px">
    <strong>{app.tip.title}</strong>
    <p>{app.tip.text}</p>
  </div>
{/if}

<style>
  .tip {
    position: fixed; z-index: 50; translate: -50% -100%; width: max-content; max-width: 260px;
    padding: 10px 14px; border-radius: var(--r-md); pointer-events: none; animation: rise 0.18s var(--ease);
    background: rgba(34, 34, 42, 0.92);
  }
  strong { font-size: 13px; }
  p { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
  @keyframes rise { from { opacity: 0; transform: translateY(4px); } }
</style>
