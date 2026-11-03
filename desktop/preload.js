// Bridge between the shared UI and the Windows (Electron) main process.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vsDesktop', {
  call: (method, args) => ipcRenderer.invoke('vs-call', method, args || {}).then((r) => { if (r && r.error) throw new Error(r.error); return r ? r.result : null; }),
  onEvent: (fn) => ipcRenderer.on('vs-event', (_e, name, data) => fn(name, data))
});
