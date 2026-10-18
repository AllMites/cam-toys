<script lang="ts">
  import Icon from './Icon.svelte'
  import { app, setSettings, snapshot } from '../state/app.svelte'

  let vcamHelp = $state(false)
  const camId = $derived(app.settings?.cameraId ?? app.cameras[0]?.deviceId ?? '')
  const fps = $derived(app.status === 'running' ? app.stats.fps : 0)
  const label = (c: MediaDeviceInfo, i: number) => c.label || `Camera ${i + 1}`
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') vcamHelp = false }} />

<header class="bar">
  <div class="left">
    <div class="brand"><span class="mark" aria-hidden="true"></span>cam-toys</div>
    <label class="cam" data-tour="camera">
      <span class="sr">Camera</span>
      <Icon name="camera" size={16} />
      <select class="field" value={camId} disabled={!app.cameras.length}
        onchange={(e) => setSettings({ cameraId: e.currentTarget.value })}>
        {#each app.cameras as c, i (c.deviceId)}
          <option value={c.deviceId}>{label(c, i)}</option>
        {:else}
          <option value="">No camera</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="center" data-tour="live">
    {#if !app.vcamOk}
      <button class="pill off" onclick={() => (vcamHelp = !vcamHelp)} aria-expanded={vcamHelp}>
        <span class="dot"></span>Camera not installed
      </button>
      {#if vcamHelp}
        <div class="pop glass" role="dialog" aria-label="Virtual camera not installed">
          <strong>The cam-toys camera isn't set up</strong>
          <p>Call apps can't see your filters yet. Run the cam-toys installer again and click <b>Yes</b> when Windows asks for permission.</p>
          <button class="btn" onclick={() => (vcamHelp = false)}>Got it</button>
        </div>
      {/if}
    {:else if app.live}
      <div class="pill live" title="Pick “cam-toys” as your camera in Discord, Zoom or Meet">
        <span class="dot"></span>LIVE in cam-toys
      </div>
    {:else}
      <div class="pill idle"><span class="dot"></span>Not sending</div>
    {/if}
  </div>

  <div class="right">
    <div class="fps" class:warn={fps > 0 && fps < 24} title="Frames per second">
      <b>{fps || '—'}</b> fps
    </div>
    <button class="icon-btn" onclick={snapshot} disabled={app.status !== 'running'} aria-label="Take a snapshot" title="Snapshot (saved to Pictures)">
      <Icon name="camera" />
    </button>
    <button class="icon-btn" class:on={app.drawerOpen} onclick={() => (app.drawerOpen = !app.drawerOpen)}
      aria-label="Toggle layers" aria-pressed={app.drawerOpen}>
      <Icon name="layers" />
    </button>
    <button class="icon-btn" onclick={() => (app.settingsOpen = true)} aria-label="Settings">
      <Icon name="gear" />
    </button>
  </div>
</header>

<style>
  .bar {
    grid-area: bar; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    padding: 0 16px 0 20px; height: 64px; position: relative; z-index: 45; /* above toasts, so the vcam popover wins */
  }
  .left, .right { display: flex; align-items: center; gap: 16px; }
  .right { justify-content: flex-end; gap: 4px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; letter-spacing: -0.02em; white-space: nowrap; }
  .mark { width: 22px; height: 22px; border-radius: 7px; background: var(--grad); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18); position: relative; }
  .mark::after { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: var(--bg); }
  .cam { position: relative; display: flex; align-items: center; color: var(--muted); }
  .cam :global(svg) { position: absolute; left: 12px; pointer-events: none; }
  .cam .field { padding-left: 36px; max-width: 260px; text-overflow: ellipsis; }
  @media (max-width: 1100px) { .cam .field { max-width: 170px; } }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

  .center { position: relative; }
  .pill {
    display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 14px 0 12px;
    border-radius: 999px; font-weight: 600; font-size: 13px; white-space: nowrap;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  .pill.live { background: var(--grad); color: #fff; box-shadow: 0 6px 24px rgba(236, 72, 153, 0.35); }
  .pill.live .dot { background: #fff; animation: pulse 1.6s ease-in-out infinite; }
  .pill.off, .pill.idle { background: var(--panel-2); color: var(--muted); border: 1px solid var(--border); }
  .pill.off:hover { color: var(--text); }
  .pill.off .dot { background: var(--faint); }
  @keyframes pulse { 50% { opacity: 0.35; transform: scale(0.8); } }

  .pop {
    position: absolute; top: 44px; left: 50%; translate: -50% 0; width: 300px; padding: 16px;
    border-radius: var(--r-lg); display: grid; gap: 8px; animation: pop 0.25s var(--spring);
  }
  .pop p { color: var(--muted); font-size: 13px; }
  .pop .btn { justify-self: end; height: 32px; }

  .fps { color: var(--muted); font-size: 13px; margin-right: 10px; font-variant-numeric: tabular-nums; min-width: 52px; text-align: right; }
  .fps b { color: var(--text); font-weight: 600; }
  .fps.warn b { color: var(--amber); }
  .icon-btn.on { color: var(--text); }
</style>
