<script lang="ts">
  // Phase 4 replaces this placeholder. It proves the settings IPC round-trip.
  const settings = window.camtoys.settings.get()
</script>

<main>
  <h1>cam-toys</h1>
  {#await settings then s}
    <p>scaffold OK · fps {s.fps}</p>
  {/await}
</main>

<style>
  main { height: 100vh; display: grid; place-content: center; text-align: center; }
  h1 { font-size: 56px; margin: 0; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  p { color: var(--muted); }
</style>
