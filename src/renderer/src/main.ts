import { mount } from 'svelte'
import './styles/tokens.css'
import App from './App.svelte'
import { mockCamtoys } from './mock/camtoys'
import { init } from './state/app.svelte'

// Plain-browser dev (no Electron preload): stand in for window.camtoys.
if (!window.camtoys) window.camtoys = mockCamtoys

await init()
export default mount(App, { target: document.getElementById('app')! })
