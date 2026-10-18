<script lang="ts">
  import Icon from './Icon.svelte'
  import { app, setSettings, openTutorial } from '../state/app.svelte'

  let dlg: HTMLDialogElement
  $effect(() => {
    if (app.settingsOpen && !dlg.open) dlg.showModal()
    else if (!app.settingsOpen && dlg.open) dlg.close()
  })

  const s = $derived(app.settings!)
  const KEY: Record<string, string> = { Control: 'Ctrl', Right: '→', Left: '←', Up: '↑', Down: '↓' }
  const keys = (combo: string) => combo.split('+').map((k) => KEY[k] ?? k)
  const RES = [[1280, 720, '720p'], [1920, 1080, '1080p']] as const
</script>

<dialog bind:this={dlg} onclose={() => (app.settingsOpen = false)} aria-labelledby="settings-title"
  onclick={(e) => { if (e.target === dlg) dlg.close() }}>
  {#if s}
    <div class="wrap">
      <header>
        <h2 id="settings-title">Settings</h2>
        <button class="icon-btn" onclick={() => dlg.close()} aria-label="Close settings"><Icon name="x" /></button>
      </header>

      <section>
        <h3>Camera</h3>
        <div class="row">
          <label for="set-cam">Webcam</label>
          <select id="set-cam" class="field" value={s.cameraId ?? app.cameras[0]?.deviceId ?? ''} disabled={!app.cameras.length}
            onchange={(e) => setSettings({ cameraId: e.currentTarget.value })}>
            {#each app.cameras as c, i (c.deviceId)}<option value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>
            {:else}<option value="">No camera found</option>{/each}
          </select>
        </div>
        <div class="row">
          <div><span class="lbl">Resolution</span><small>1080p looks sharper but works your computer harder.</small></div>
          <div class="seg" role="group" aria-label="Resolution">
            {#each RES as [w, h, name] (name)}
              <button aria-pressed={s.width === w} onclick={() => setSettings({ width: w, height: h })}>{name}</button>
            {/each}
          </div>
        </div>
        <div class="row">
          <div><span class="lbl">Frame rate</span><small>60 is smoother. Most calls send 30 anyway.</small></div>
          <div class="seg" role="group" aria-label="Frame rate">
            {#each [30, 60] as f (f)}
              <button aria-pressed={s.fps === f} onclick={() => setSettings({ fps: f })}>{f} fps</button>
            {/each}
          </div>
        </div>
      </section>

      <section>
        <h3>Shortcuts</h3>
        <p class="note">Work even when cam-toys is hidden, so you can switch looks mid-call.</p>
        {#each [['Next preset', s.hotkeys.next], ['Previous preset', s.hotkeys.prev]] as [name, combo] (name)}
          <div class="row">
            <span class="lbl">{name}</span>
            <span class="keys">{#each keys(combo) as k, i (i)}{#if i}<span class="plus">+</span>{/if}<kbd>{k}</kbd>{/each}</span>
          </div>
        {/each}
      </section>

      <section>
        <h3>App</h3>
        <div class="row">
          <label for="set-tray"><span class="lbl">Keep running in the tray</span><small>Closing the window keeps your filter on in calls.</small></label>
          <input id="set-tray" type="checkbox" role="switch" class="switch" checked={s.closeToTray}
            onchange={(e) => setSettings({ closeToTray: e.currentTarget.checked })} />
        </div>
        <div class="row">
          <div><span class="lbl">Tutorial</span><small>See the quick tour again.</small></div>
          <button class="btn" onclick={openTutorial}>Replay tutorial</button>
        </div>
      </section>
    </div>
  {/if}
</dialog>

<style>
  dialog { width: min(520px, calc(100vw - 32px)); }
  .wrap { padding: 8px 24px 24px; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 12px 0 4px; }
  h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
  section { padding: 14px 0; border-top: 1px solid var(--hairline); display: grid; gap: 10px; }
  header + section { border-top: 0; }
  h3 { font-size: 12px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: 0.06em; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 40px; }
  .row label, .row > span { cursor: default; }
  .lbl { display: block; font-weight: 500; }
  small { display: block; color: var(--muted); font-size: 12.5px; margin-top: 1px; }
  .note { color: var(--muted); font-size: 12.5px; margin-top: -4px; }
  .field { max-width: 260px; }
  .keys { display: flex; align-items: center; gap: 4px; }
  .plus { color: var(--faint); font-size: 12px; }
</style>
