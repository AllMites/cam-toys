<script lang="ts">
  import { app } from '../state/app.svelte'

  let dlg: HTMLDialogElement
  $effect(() => { if (app.heavyAsk && !dlg.open) dlg.showModal() })

  function answer(ok: boolean) {
    const ask = app.heavyAsk
    app.heavyAsk = null
    dlg.close()
    if (ok) ask?.run()
  }
</script>

<dialog bind:this={dlg} onclose={() => (app.heavyAsk = null)} aria-labelledby="heavy-title">
  <div class="wrap">
    <div class="badge" aria-hidden="true">⚡</div>
    <h2 id="heavy-title">This one is heavy</h2>
    <p><b>{app.heavyAsk?.names}</b> separates you from your background every frame. On laptops that can make your video stutter.</p>
    <p class="muted">If it gets choppy, hide the ⚡ layer or switch to 720p in Settings.</p>
    <div class="actions">
      <button class="btn ghost" onclick={() => answer(false)}>Cancel</button>
      <button class="btn primary" onclick={() => answer(true)}>Add anyway</button>
    </div>
  </div>
</dialog>

<style>
  dialog { width: min(400px, calc(100vw - 32px)); }
  .wrap { padding: 28px 24px 20px; display: grid; gap: 10px; text-align: center; justify-items: center; }
  .badge {
    width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 26px;
    background: rgba(251, 191, 36, 0.12); border: 2px solid var(--amber); margin-bottom: 4px;
  }
  h2 { font-size: 18px; font-weight: 700; }
  p { color: var(--text); font-size: 14px; }
  .muted { color: var(--muted); font-size: 13px; }
  .actions { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
</style>
