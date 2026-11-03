// Runs inside the official MSEDCL site window: reports alert() texts so the Application ID can be captured.
const { ipcRenderer, webFrame } = require('electron');
webFrame.executeJavaScript(`(function(){var oa=window.alert;window.alert=function(m){try{window.postMessage({__vsAlert:String(m)},'*')}catch(e){};return oa.apply(window,arguments)};})()`);
window.addEventListener('message', (e) => { if (e.data && e.data.__vsAlert) ipcRenderer.send('vs-official-text', e.data.__vsAlert); });
