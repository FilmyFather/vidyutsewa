/* VidyutSewa By Yuvraj - one promise based bridge for Android (Kotlin) and Windows (Electron).
 * Android: window.VSAndroid.call(method, argsJson, callbackId) -> window.__vsCb(callbackId, resultJson)
 * Electron: window.vsDesktop.call(method, args) -> Promise
 * Browser (dev preview): localStorage + fetch fallbacks. */
(function () {
  'use strict';
  var cbs = {}, seq = 0, listeners = {};
  var platform = window.VSAndroid ? 'android' : (window.vsDesktop ? 'windows' : 'web');

  window.__vsCb = function (id, json) {
    var cb = cbs[id]; if (!cb) return; delete cbs[id];
    var r; try { r = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { r = { error: 'Bad Native Reply' }; }
    if (r && r.error) cb.rej(new Error(r.error)); else cb.res(r ? r.result : null);
  };
  // native -> JS events (status changed, official site result, back button ...)
  window.__vsEvent = function (name, json) {
    var data; try { data = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { data = json; }
    (listeners[name] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } });
  };

  function webFallback(method, args) {
    switch (method) {
      case 'loadData': return Promise.resolve(localStorage.getItem('vs-data') || '');
      case 'saveData': localStorage.setItem('vs-data', args.json); return Promise.resolve(true);
      case 'http': return fetch(args.url, { method: args.method || 'GET', headers: args.headers || {} })
        .then(function (r) { return r.text().then(function (t) { return { status: r.status, body: t }; }); });
      case 'saveDoc': localStorage.setItem('vs-doc-' + args.id + '-' + args.slot, JSON.stringify(args)); return Promise.resolve({ size: Math.round(args.b64.length * 3 / 4) });
      case 'readDoc': var d = localStorage.getItem('vs-doc-' + args.id + '-' + args.slot); return Promise.resolve(d ? JSON.parse(d) : null);
      case 'deleteDocs': Object.keys(localStorage).forEach(function (k) { if (k.indexOf('vs-doc-' + args.id + '-') === 0) localStorage.removeItem(k); }); return Promise.resolve(true);
      case 'openExternal': window.open(args.url, '_blank'); return Promise.resolve(true);
      case 'appInfo': return Promise.resolve({ version: '1.0.1', platform: 'web' });
      case 'storageInfo': return Promise.resolve({ docs: 0, cache: 0 });
      case 'notify': try { new Notification(args.title, { body: args.body }); } catch (e) {} return Promise.resolve(true);
      default: return Promise.resolve(null);
    }
  }

  function call(method, args) {
    args = args || {};
    if (platform === 'android') {
      return new Promise(function (res, rej) {
        var id = 'c' + (++seq);
        cbs[id] = { res: res, rej: rej };
        try { window.VSAndroid.call(method, JSON.stringify(args), id); } catch (e) { delete cbs[id]; rej(e); }
      });
    }
    if (platform === 'windows') return window.vsDesktop.call(method, args);
    return webFallback(method, args);
  }
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  if (window.vsDesktop && window.vsDesktop.onEvent) window.vsDesktop.onEvent(function (name, data) { window.__vsEvent(name, data); });

  window.Native = { platform: platform, call: call, on: on };
})();
