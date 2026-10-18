<script lang="ts">
  import { tick } from 'svelte'
  import { app, closeTutorial } from '../state/app.svelte'

  const STEPS = [
    { target: 'camera', icon: '📷', title: 'Pick your camera', text: 'Choose the webcam you want to use up here. Your real camera stays private: call apps only see cam-toys.' },
    { target: 'carousel', icon: '🐻', title: 'Tap a bubble', text: 'Every bubble is a filter. Tap Bear to try it, tap again to take it off. Hover a bubble to see what it does.' },
    { target: 'layers', icon: '🥞', title: 'Stack them up', text: 'Filters pile up in Layers. Drag to reorder, hit the eye to hide one, ✕ to remove, and use the sliders to tweak.' },
    { target: 'live', icon: '💬', title: 'Open Discord, choose “cam-toys”', text: 'In Discord go to Settings › Voice & Video › Camera and pick cam-toys. Same idea in Zoom, Meet and Teams.' },
    { target: null, icon: '🖥️', title: 'It lives in the tray', text: 'Closing the window keeps cam-toys running by the clock, so your call keeps its filter. Right-click the tray icon to quit.' }
  ]

  const step = $derived(STEPS[app.tutorialStep])
  let rect = $state<DOMRect | null>(null)
  let vw = $state(innerWidth), vh = $state(innerHeight)

  $effect(() => {
    if (step?.target === 'layers') app.drawerOpen = true
    const target = step?.target
    void vw, vh // re-measure on resize
    // after the DOM update, so layout changes (drawer opening) have landed
    tick().then(() => {
      rect = target ? document.querySelector(`[data-tour="${target}"]`)?.getBoundingClientRect() ?? null : null
    })
  })

  const PAD = 8, CARD_W = 340
  const spot = $derived(rect && { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 })
  // Card goes below the spotlight, else above, else to its left (tall targets); centered with no target.
  const CARD_H = 240
  const card = $derived.by(() => {
    if (!spot) return null
    const clampX = (x: number) => Math.min(Math.max(x, 16), vw - CARD_W - 16)
    const below = spot.y + spot.h + 16
    if (below + CARD_H < vh) return { left: clampX(spot.x + spot.w / 2 - CARD_W / 2), top: below, bottom: null }
    if (spot.y - 16 - CARD_H > 0) return { left: clampX(spot.x + spot.w / 2 - CARD_W / 2), top: null, bottom: vh - spot.y + 16 }
    return { left: clampX(spot.x - CARD_W - 20), top: Math.max(16, spot.y + spot.h / 2 - CARD_H / 2), bottom: null }
  })

  const next = () => (app.tutorialStep < STEPS.length - 1 ? app.tutorialStep++ : closeTutorial())
  function keys(e: KeyboardEvent) {
    if (!step) return
    if (e.key === 'Escape') closeTutorial()
    else if (e.key === 'ArrowRight') next() // Enter is handled by the focused Next button
    else if (e.key === 'ArrowLeft' && app.tutorialStep > 0) app.tutorialStep--
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} onkeydown={keys} />

{#if step}
  <div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    {#if spot}
      <div class="spot" style:left="{spot.x}px" style:top="{spot.y}px" style:width="{spot.w}px" style:height="{spot.h}px"></div>
    {:else}
      <div class="scrim"></div>
    {/if}

    {#key app.tutorialStep}
      <div class="card" class:center={!card}
        style:left={card ? `${card.left}px` : null}
        style:top={card?.top != null ? `${card.top}px` : null}
        style:bottom={card?.bottom != null ? `${card.bottom}px` : null}>
        <div class="icon" aria-hidden="true">{step.icon}</div>
        <p class="count">Step {app.tutorialStep + 1} of {STEPS.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p class="text">{step.text}</p>
        <footer>
          <div class="dots" aria-hidden="true">
            {#each STEPS as _, i (i)}<span class:on={i === app.tutorialStep}></span>{/each}
          </div>
          <div class="btns">
            {#if app.tutorialStep > 0}
              <button class="btn ghost" onclick={() => app.tutorialStep--}>Back</button>
            {:else}
              <button class="btn ghost" onclick={closeTutorial}>Skip</button>
            {/if}
            <!-- svelte-ignore a11y_autofocus -->
            <button class="btn primary" onclick={next} autofocus>{app.tutorialStep === STEPS.length - 1 ? 'Let’s go' : 'Next'}</button>
          </div>
        </footer>
      </div>
    {/key}
  </div>
{/if}

<style>
  .tour { position: fixed; inset: 0; z-index: 60; }
  .scrim { position: absolute; inset: 0; background: rgba(5, 5, 8, 0.7); backdrop-filter: blur(4px); animation: fade 0.3s; }
  .spot {
    position: absolute; border-radius: var(--r-lg); pointer-events: none;
    box-shadow: 0 0 0 9999px rgba(5, 5, 8, 0.72), 0 0 0 2px var(--pink), 0 0 32px rgba(236, 72, 153, 0.45);
    transition: all 0.45s var(--ease);
  }
  .card {
    position: absolute; width: 340px; padding: 22px 22px 18px; border-radius: var(--r-xl);
    background: var(--panel); border: 1px solid var(--hairline); box-shadow: var(--shadow-lg);
    animation: pop 0.35s var(--spring);
  }
  .card.center { left: 50%; top: 50%; translate: -50% -50%; width: 380px; text-align: center; }
  .card.center footer { justify-content: space-between; }
  .icon {
    width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; font-size: 24px;
    background: var(--grad); box-shadow: 0 8px 20px rgba(236, 72, 153, 0.3); margin-bottom: 14px;
  }
  .center .icon { margin-inline: auto; }
  .count { font-size: 12px; font-weight: 600; color: var(--pink); letter-spacing: 0.02em; }
  h2 { font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 2px 0 6px; }
  .text { color: var(--muted); font-size: 14px; }
  footer { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; }
  .btns { display: flex; gap: 6px; }
  .dots { display: flex; gap: 6px; }
  .dots span { width: 6px; height: 6px; border-radius: 999px; background: var(--border); transition: width 0.3s var(--spring), background 0.2s; }
  .dots span.on { width: 18px; background: var(--grad); }
  @keyframes fade { from { opacity: 0; } }
</style>
