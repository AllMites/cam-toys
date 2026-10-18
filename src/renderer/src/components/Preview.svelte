<script lang="ts">
  import type { Need } from '@engine/types'
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'
  import { app, startCamera, toggleCamera } from '../state/app.svelte'

  let canvas: HTMLCanvasElement
  onMount(() => { startCamera(canvas) })

  const NEED_LABEL: Record<Need, string> = {
    face: 'face tracking', hands: 'hand tracking', gestures: 'gestures', pose: 'body tracking', segment: 'background magic'
  }
  const ERRORS = {
    nocam: { icon: '📷', title: 'No camera found', text: 'Plug in a webcam, then press Try again.' },
    busy: { icon: '🔒', title: 'Your camera is busy', text: 'Another app is using it. Close Zoom, Discord or the browser tab that has it, then try again. In calls, pick “cam-toys” as your camera, not your real one.' },
    denied: { icon: '🚫', title: 'Camera access is off', text: 'Turn it on in Windows Settings › Privacy & security › Camera › “Let desktop apps access your camera”.' },
    other: { icon: '😵', title: 'The camera didn’t start', text: 'Something went wrong. Try again, or pick another camera at the top.' }
  }
  const err = $derived(app.error ? ERRORS[app.error] : null)
</script>

<section class="stage">
  <div class="frame">
    <canvas bind:this={canvas} class:hidden={app.status !== 'running'}></canvas>

    {#if app.status === 'starting'}
      <div class="state">
        <div class="spinner" aria-hidden="true"></div>
        <p class="muted">Starting camera…</p>
      </div>
    {:else if app.status === 'paused'}
      <div class="state">
        <div class="big">⏸️</div>
        <h2>Camera paused</h2>
        <p class="muted">Your call keeps showing the last frame.</p>
        <button class="btn primary" onclick={toggleCamera}><Icon name="refresh" size={16} />Resume</button>
      </div>
    {:else if err}
      <div class="state" role="alert">
        <div class="big">{err.icon}</div>
        <h2>{err.title}</h2>
        <p class="muted">{err.text}</p>
        {#if app.error === 'other' && app.errorMsg}<code>{app.errorMsg}</code>{/if}
        <button class="btn primary" onclick={() => startCamera()}><Icon name="refresh" size={16} />Try again</button>
      </div>
    {/if}

    {#if app.loading.length && app.status === 'running'}
      <div class="loading shimmer" role="status">
        Loading {app.loading.map((n) => NEED_LABEL[n]).join(' + ')}…
      </div>
    {/if}
  </div>
</section>

<style>
  .stage { grid-area: stage; display: grid; place-items: center; padding: 8px 24px 0; min-height: 0; min-width: 0; container-type: size; }
  .frame {
    position: relative; width: min(100cqw, 100cqh * 16 / 9); aspect-ratio: 16 / 9;
    border-radius: var(--r-xl); overflow: hidden; background: #08080a;
    box-shadow: var(--shadow-lg), 0 0 0 1px var(--hairline);
  }
  canvas { display: block; width: 100%; height: 100%; transition: opacity 0.3s; }
  canvas.hidden { opacity: 0; }
  .state {
    position: absolute; inset: 0; display: grid; place-content: center; justify-items: center;
    gap: 10px; padding: 32px; text-align: center; animation: fade 0.3s var(--ease);
    background: radial-gradient(600px 300px at 50% 40%, rgba(139, 92, 246, 0.1), transparent);
  }
  .state h2 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .state p { max-width: 400px; }
  .state .btn { margin-top: 8px; }
  .muted { color: var(--muted); }
  .big { font-size: 44px; line-height: 1; margin-bottom: 4px; }
  code { font-size: 12px; color: var(--faint); }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid var(--border); border-top-color: var(--pink); animation: spin 0.8s linear infinite;
  }
  .loading {
    position: absolute; top: 16px; left: 50%; translate: -50% 0; padding: 8px 16px; border-radius: 999px;
    font-size: 13px; font-weight: 600; color: var(--text); border: 1px solid var(--hairline);
    background-color: rgba(26, 26, 32, 0.8); animation: shimmer 1.3s linear infinite, fade 0.3s var(--ease);
  }
  @keyframes spin { to { transform: rotate(1turn); } }
  @keyframes fade { from { opacity: 0; } }
</style>
