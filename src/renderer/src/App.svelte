<script lang="ts">
  import TopBar from './components/TopBar.svelte'
  import Preview from './components/Preview.svelte'
  import Carousel from './components/Carousel.svelte'
  import LayersDrawer from './components/LayersDrawer.svelte'
  import SettingsModal from './components/SettingsModal.svelte'
  import ConfirmHeavy from './components/ConfirmHeavy.svelte'
  import Tutorial from './components/Tutorial.svelte'
  import Toasts from './components/Toasts.svelte'
  import Tooltip from './components/Tooltip.svelte'
  import { app } from './state/app.svelte'
</script>

<div class="shell" class:drawer={app.drawerOpen}>
  <TopBar />
  <Preview />
  <Carousel />
  {#if app.drawerOpen}<LayersDrawer />{/if}
</div>

<Toasts />
<Tooltip />
<SettingsModal />
<ConfirmHeavy />
<Tutorial />

<style>
  .shell {
    height: 100vh; display: grid;
    grid-template: 'bar bar' 64px 'stage drawer' 1fr 'dock drawer' auto / 1fr 0;
  }
  .shell.drawer { grid-template-columns: 1fr 340px; }
  @media (max-width: 1100px) { .shell.drawer { grid-template-columns: 1fr 300px; } }
</style>
