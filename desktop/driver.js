// Hidden official-site session for the Windows app: the same job as Driver.kt on Android.
// A hidden BrowserWindow loads the real wss.mahadiscom.in pages and runs the page's own JavaScript (login encryption, captcha, OTP buttons);
// vsdrv.js (shared with Android) is injected to find fields by their labels. Nothing is submitted, uploaded or paid here:
// the screens call it only after the person's own tap. "Reveal" shows the same window (Open Official Page fallback and the official payment page).
const { BrowserWindow, ipcMain, safeStorage, clipboard, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function createDriver(ctx) {
  const DRV = () => fs.readFileSync(path.join(__dirname, 'web', 'js', 'vsdrv.js'), 'utf8');
  let dw = null, revealed = false, showResolve = null, copyChips = [], title = 'Official Page';
  let startSeq = 0, finishSeq = 0;
  const msgs = [];
  const waiters = [];

  ipcMain.on('vs-drv-msg', (_e, m) => { msgs.push(m); while (msgs.length > 40) msgs.shift(); });
  ipcMain.on('vs-drv-copy', (_e, t) => { clipboard.writeText(String(t || '')); });
  ipcMain.on('vs-drv-back', () => hide());
  ipcMain.on('vs-drv-revealed', (e) => { e.returnValue = revealed; });

  function ensure() {
    if (dw && !dw.isDestroyed()) return dw;
    dw = new BrowserWindow({
      width: 1180, height: 900, show: false, title: 'Official MSEDCL Site', icon: ctx.iconPath(), autoHideMenuBar: true, backgroundColor: '#ffffff',
      webPreferences: { partition: 'persist:wssdrv', preload: path.join(__dirname, 'preload-drv.js'), contextIsolation: false, sandbox: false, nodeIntegration: false, backgroundThrottling: false }
    });
    dw.removeMenu();
    const wc = dw.webContents;
    wc.setUserAgent(ctx.UA);
    wc.on('did-start-navigation', (_e, _url, isInPlace, isMainFrame) => { if (isMainFrame && !isInPlace) startSeq++; });
    const done = async (info) => {
      const ws = waiters.splice(0);   // only the loads that were waiting when THIS page finished (a stale about:blank must not release the next load)
      finishSeq++;
      try { await wc.executeJavaScript('(function(){try{if(!window.__vsd){' + DRV() + '}}catch(e){}})()'); } catch (e) {}
      if (revealed) await decorate();
      ws.forEach((f) => f(info));
    };
    wc.on('did-finish-load', () => done({ url: wc.getURL(), title: wc.getTitle() }));
    wc.on('did-fail-load', (_e, code, desc, url, isMain) => { if (isMain && code !== -3) done({ url, error: desc }); });
    wc.setWindowOpenHandler(({ url }) => {
      if (revealed && /^https?:/i.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1000, height: 800, autoHideMenuBar: true, webPreferences: { partition: 'persist:wssdrv' } } };
      msgs.push({ k: 'open', t: String(url).slice(0, 400), at: Date.now() });
      return { action: 'deny' };
    });
    wc.on('will-navigate', (e, url) => { if (!/^(https?:|about:|data:|blob:|file:)/i.test(url)) { e.preventDefault(); msgs.push({ k: 'blocked', t: String(url).slice(0, 200), at: Date.now() }); } });
    wc.session.on('will-download', (_e, item) => {
      const name = item.getFilename().replace(/[^A-Za-z0-9._-]/g, '_');
      item.setSavePath(path.join(ctx.dlDir(), name));
      item.once('done', (_ev, st) => { if (st === 'completed') { try { new Notification({ title: 'Downloaded', body: name }).show(); } catch (e) {} } });
    });
    dw.on('close', (e) => { if (!ctx.isQuitting()) { e.preventDefault(); if (revealed) hide(); } });
    return dw;
  }

  async function decorate() {   // top bar with "Back To App" and copy buttons, shown only while the page is revealed
    const wc = dw.webContents;
    const chips = JSON.stringify(copyChips), ttl = JSON.stringify(title);
    try {
      await wc.insertCSS('input[type=text],input[type=password],select,textarea{font-size:15px!important;min-height:30px!important}input[type=submit],input[type=button],button{font-size:15px!important;min-height:34px!important;cursor:pointer}');
      await wc.executeJavaScript('window.__vsd&&__vsd.setReveal(true);(function(){var old=document.getElementById("vs-bar");if(old)old.remove();var chips=' + chips + ';var b=document.createElement("div");b.id="vs-bar";b.style.cssText="position:sticky;top:0;left:0;right:0;z-index:2147483647;background:#0B1744;color:#fff;font:14px Segoe UI,Arial,sans-serif;padding:6px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap";var t=document.createElement("b");t.textContent="\\uD83D\\uDD12 "+' + ttl + ';b.appendChild(t);chips.forEach(function(c){var x=document.createElement("button");x.type="button";x.textContent="Copy "+c.l;x.style.cssText="background:#BFE9F5;color:#0B1744;border:0;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer";x.onclick=function(ev){ev.preventDefault();window.__vsCopy(c.v);x.textContent="Copied: "+c.l;setTimeout(function(){x.textContent="Copy "+c.l},1400)};b.appendChild(x)});var k=document.createElement("button");k.type="button";k.textContent="Back To App";k.style.cssText="margin-left:auto;background:#7DE9FF;color:#0B1744;border:0;border-radius:6px;padding:5px 14px;font-weight:700;cursor:pointer";k.onclick=function(ev){ev.preventDefault();window.__vsBack()};b.appendChild(k);(document.body||document.documentElement).insertBefore(b,(document.body||document.documentElement).firstChild)})()');
    } catch (e) {}
  }

  function hide() {
    if (!dw || dw.isDestroyed() || !revealed) return;
    revealed = false;
    try { dw.webContents.executeJavaScript('window.__vsd&&__vsd.setReveal(false);var b=document.getElementById("vs-bar");if(b)b.remove();').catch(() => {}); } catch (e) {}
    dw.hide();
    const win = ctx.getWin(); if (win && !win.isDestroyed()) { win.show(); win.focus(); }
    const r = showResolve; showResolve = null; if (r) r({ closed: true });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  return {
    drvLoad: (a) => new Promise((resolve) => {
      const w = ensure(); let fin = false;
      const cb = (info) => { if (!fin) { fin = true; resolve(info); } };
      waiters.push(cb);
      setTimeout(() => { if (!fin) { fin = true; resolve({ url: w.webContents.getURL(), timeout: true }); } }, 30000);
      w.loadURL(a.url).catch(() => {});
    }),
    drvEval: async (a) => {
      const w = ensure();
      const js = '(function(){try{if(!window.__vsd){' + DRV() + '}}catch(e){} return Promise.resolve().then(function(){return (' + a.script + ')}).then(function(r){return JSON.stringify({v:r===undefined?null:r})},function(e){return JSON.stringify({e:String(e&&e.message||e)})})})()';
      let to; const timeout = new Promise((_r, rej) => { to = setTimeout(() => rej(new Error('The official page changed before it answered.')), a.timeout || 20000); });
      try {
        const out = await Promise.race([w.webContents.executeJavaScript(js, true), timeout]);
        const o = JSON.parse(out);
        if (o.e) throw new Error(o.e);
        return o.v === undefined ? null : o.v;
      } catch (e) { throw new Error(String(e.message || e).replace(/^Error invoking remote method[^:]*: Error: /, '')); }
      finally { clearTimeout(to); }
    },
    drvSeq: () => ({ seq: finishSeq, start: startSeq }),
    drvWaitNav: async (a) => {
      const t0 = Date.now(), ms = a.ms || 8000, quick = a.quick || 1800;
      while (Date.now() - t0 < ms) {
        if (finishSeq > (a.seq | 0)) { await sleep(200); return { navigated: true }; }
        if (startSeq <= (a.start | 0) && Date.now() - t0 > quick) return { navigated: false };
        await sleep(80);
      }
      return { navigated: false };
    },
    drvMsgs: async () => {
      const out = msgs.splice(0);
      try { if (dw && !dw.isDestroyed()) { const d = await dw.webContents.executeJavaScript('window.__vsd?JSON.stringify(__vsd.drain().msgs):"[]"'); JSON.parse(d).forEach((m) => out.push(m)); } } catch (e) {}
      return { msgs: out };
    },
    drvReset: async () => {
      const w = ensure(); const s = w.webContents.session;
      await s.clearStorageData(); await s.clearCache(); msgs.length = 0;
      try { await w.loadURL('about:blank'); } catch (e) {}
      return true;
    },
    drvShow: (a) => new Promise((resolve) => {
      const w = ensure();
      revealed = true; showResolve = resolve; copyChips = (a.copy || []).map((c) => ({ l: String(c.l), v: String(c.v) })); title = a.title || 'Official Page';
      w.setTitle('Official MSEDCL Site - ' + title);
      w.show(); w.focus();
      decorate();
    }),
    drvHide: () => { hide(); return true; },
    copy: (a) => { clipboard.writeText(String(a.text || '')); return true; },
    // Login name and password: encrypted with Windows' own protection (DPAPI) and kept in this app's private folder only.
    credGet: () => {
      const f = path.join(ctx.userDir(), 'wss-login.bin');
      try {
        if (!fs.existsSync(f) || !safeStorage.isEncryptionAvailable()) return null;
        const j = JSON.parse(safeStorage.decryptString(fs.readFileSync(f)));
        return { user: j.u || '', pass: j.p || '' };
      } catch (e) { try { fs.rmSync(f, { force: true }); } catch (e2) {} return null; }
    },
    credSet: (a) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is not available on this PC');
      fs.writeFileSync(path.join(ctx.userDir(), 'wss-login.bin'), safeStorage.encryptString(JSON.stringify({ u: a.user, p: a.pass || '' })));
      return true;
    },
    credClear: () => { try { fs.rmSync(path.join(ctx.userDir(), 'wss-login.bin'), { force: true }); } catch (e) {} return true; },
    destroy: () => { try { if (dw && !dw.isDestroyed()) { dw.destroy(); } } catch (e) {} }
  };
};
