// Preload of the hidden official-site window (contextIsolation off on purpose: it must wrap the page's own alert/confirm before the page runs).
const { ipcRenderer } = require('electron');
const na = window.alert.bind(window), nc = window.confirm.bind(window), np = window.prompt.bind(window);
const rev = () => { try { return ipcRenderer.sendSync('vs-drv-revealed'); } catch (e) { return false; } };
const note = (k, m) => { try { ipcRenderer.send('vs-drv-msg', { k, t: String(m).slice(0, 400), at: Date.now() }); } catch (e) {} };
window.alert = (m) => { if (rev()) return na(m); note('alert', m); };
window.confirm = (m) => { if (rev()) return nc(m); note('confirm', m); return true; };
window.prompt = (m, d) => { if (rev()) return np(m, d); note('prompt', m); return d || ''; };
window.__vsCopy = (t) => ipcRenderer.send('vs-drv-copy', String(t || ''));
window.__vsBack = () => ipcRenderer.send('vs-drv-back');
