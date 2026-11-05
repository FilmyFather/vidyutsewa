// VidyutSewa By Yuvraj - Windows desktop app (Electron). All data stays on this PC (userData folder).
const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu, protocol, net, session, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const APP_ID = 'com.filmyfather.vidyutsewa';
const WEB = path.join(__dirname, 'web');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
let win = null, tray = null, quitting = false;

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId(APP_ID);

const userDir = () => app.getPath('userData');
const dataFile = () => path.join(userDir(), 'data.json');
const vaultDir = (id) => path.join(userDir(), 'vault', String(id).replace(/[^A-Za-z0-9_-]/g, ''));
const SLOT_FILE = { formx: 'formx.pdf', single: 'single.pdf', receiptimg: 'receipt_img.jpg', receiptpdf: 'receipt_pdf.pdf' };
const docFile = (id, slot) => path.join(vaultDir(id), SLOT_FILE[slot] || 'agreement.pdf');
const safeName = (n) => n.replace(/[^A-Za-z0-9_.-]+/g, '_');   // letters, digits, _ - and the extension only
const docName = (id, slot) => safeName((slot === 'formx' ? 'FormX_' : slot === 'single' ? 'SpellingCorrection_' : slot === 'receiptimg' || slot === 'receiptpdf' ? 'Receipt_' : 'Agreement_') + id + (slot === 'receiptimg' ? '.jpg' : '.pdf'));
const dlDir = () => { const d = path.join(app.getPath('downloads'), 'VidyutSewa'); fs.mkdirSync(d, { recursive: true }); return d; };
function dirSize(p) { try { const s = fs.statSync(p); if (s.isFile()) return s.size; return fs.readdirSync(p).reduce((a, f) => a + dirSize(path.join(p, f)), 0); } catch (e) { return 0; } }
function event(name, data) { if (win && !win.isDestroyed()) win.webContents.send('vs-event', name, JSON.stringify(data || {})); }
function iconPath() { return path.join(__dirname, 'build', 'icon.png'); }

function createWindow() {
  win = new BrowserWindow({
    width: 520, height: 920, minWidth: 380, minHeight: 640, title: 'VidyutSewa By Yuvraj', backgroundColor: '#050A24',
    icon: iconPath(), autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, spellcheck: false }
  });
  win.removeMenu();
  win.loadURL('app://local/index.html');
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); if (tray && !global.__toldTray) { global.__toldTray = 1; new Notification({ title: 'VidyutSewa Is Still Running', body: 'Status Checks Continue In The Background. Right-Click The Tray Icon To Quit.' }).show(); } }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && ((input.alt && input.key === 'ArrowLeft') || input.key === 'BrowserBack')) event('back');
    if (input.type === 'keyDown' && input.key === 'F12' && input.control && input.shift) win.webContents.openDevTools({ mode: 'detach' });
  });
}

function createTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 }));
    tray.setToolTip('VidyutSewa By Yuvraj');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open VidyutSewa', click: () => { win.show(); win.focus(); } },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', () => { win.show(); win.focus(); });
  } catch (e) { tray = null; }
}

/* ---------- HTTP (main process: no CORS, cookie jar per session name) ---------- */
function multipartBody(fields, files) {
  const boundary = '----VidyutSewa' + Date.now();
  const parts = [];
  for (const [k, v] of Object.entries(fields || {})) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  for (const f of files || []) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.field}"; filename="${f.name}"\r\nContent-Type: ${f.mime || 'application/pdf'}\r\n\r\n`));
    parts.push(Buffer.from(f.b64, 'base64')); parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), type: 'multipart/form-data; boundary=' + boundary };
}
async function http(a) {
  const ses = session.fromPartition('vs-' + (a.session || 'ui'));
  const headers = Object.assign({}, a.headers || {});
  headers['User-Agent'] = headers['User-Agent'] && /VidyutSewa/.test(headers['User-Agent']) ? headers['User-Agent'] : UA;
  const opt = { method: a.method || 'GET', headers, redirect: 'follow' };
  if (a.multipart) { const m = multipartBody(a.multipart.fields, a.multipart.files); opt.body = m.body; headers['Content-Type'] = m.type; opt.method = 'POST'; }
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), a.multipart ? 60000 : 30000); opt.signal = ctl.signal;
  try {
    const r = await ses.fetch(a.url, opt);
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, contentType: r.headers.get('content-type') || '', body: a.responseType === 'base64' ? buf.toString('base64') : buf.toString('utf8') };
  } finally { clearTimeout(tm); }
}

/* ---------- Official MSEDCL site window ---------- */
const OFFICIAL_CSS = 'input[type=text],input[type=password],select,textarea{font-size:15px!important;min-height:30px!important}input[type=submit],input[type=button],button{font-size:15px!important;min-height:34px!important;cursor:pointer}';
function findId(text) {
  const s = String(text || '').replace(/\s+/g, ' ');
  const m = s.match(/application\s*(?:id|no\.?|number)\s*(?:is|:|-)?\s*[:\-]?\s*(\d{8})\b/i) || s.match(/applicationno=(\d{8})/i);
  return m ? m[1] : '';
}
function openOfficial(a) {
  return new Promise((resolve) => {
    let captured = '';
    const ow = new BrowserWindow({
      width: 1180, height: 900, parent: win, title: 'Official MSEDCL Site', icon: iconPath(), autoHideMenuBar: true, backgroundColor: '#ffffff',
      webPreferences: { partition: 'persist:official', preload: path.join(__dirname, 'preload-official.js'), contextIsolation: true, sandbox: false }
    });
    ow.removeMenu();
    const ids = [a.appId, 'draft'].filter(Boolean);
    const copied = [];
    for (const id of ids) for (const slot of ['agreement', 'formx', 'single']) {
      const f = docFile(id, slot);
      if (fs.existsSync(f)) { const d = path.join(dlDir(), id === 'draft' ? 'New_Application' : id); fs.mkdirSync(d, { recursive: true }); const out = path.join(d, docName(id === 'draft' ? 'New' : id, slot)); fs.copyFileSync(f, out); copied.push(out); }
    }
    const scan = (t) => {
      const id = findId(t);
      if (id && !captured && (a.mode === 'apply' || a.appId === 'draft' || !a.appId)) { captured = id; event('applicationId', { id }); ow.setTitle('Official MSEDCL Site - Application ID ' + id + ' Captured'); }
    };
    const onText = (_e, t) => scan(t);
    ipcMain.on('vs-official-text', onText);
    ow.webContents.on('did-finish-load', async () => {
      ow.webContents.insertCSS(OFFICIAL_CSS).catch(() => {});
      scan(ow.webContents.getURL());
      try { scan(await ow.webContents.executeJavaScript('document.body ? document.body.innerText.slice(0, 20000) : ""')); } catch (e) {}
      if (copied.length) {
        const where = path.dirname(copied[0]).replace(/\\/g, '\\\\');
        ow.webContents.executeJavaScript(`(function(){if(document.getElementById('vs-banner'))return;var b=document.createElement('div');b.id='vs-banner';b.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0B1744;color:#fff;font:14px sans-serif;padding:8px 12px;text-align:center';b.textContent='VidyutSewa: Your Saved PDFs Are In ${where} (Choose Them When The Site Asks For A File)';document.body.appendChild(b);})()`).catch(() => {});
      }
    });
    ow.webContents.on('did-navigate', (_e, url) => scan(url));
    ow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1000, height: 800, autoHideMenuBar: true, webPreferences: { partition: 'persist:official' } } };
      shell.openExternal(url); return { action: 'deny' };
    });
    ow.webContents.session.on('will-download', (_e, item) => {
      item.setSavePath(path.join(dlDir(), item.getFilename().replace(/[^A-Za-z0-9._-]/g, '_')));
      item.once('done', (_ev, state) => { if (state === 'completed') shell.showItemInFolder(item.getSavePath()); });
    });
    ow.webContents.setUserAgent(UA);
    ow.loadURL(a.url);
    ow.on('closed', () => { ipcMain.removeListener('vs-official-text', onText); resolve({ applicationId: captured }); });
  });
}

/* ---------- bridge ---------- */
const driver = require('./driver.js')({ getWin: () => win, iconPath, dlDir, UA, userDir, isQuitting: () => quitting });
const handlers = {
  ...driver,
  loadData: () => fs.existsSync(dataFile()) ? fs.readFileSync(dataFile(), 'utf8') : '',
  saveData: (a) => { const tmp = dataFile() + '.tmp'; fs.writeFileSync(tmp, a.json); fs.renameSync(tmp, dataFile()); return true; },
  http,
  saveDoc: (a) => { fs.mkdirSync(vaultDir(a.id), { recursive: true }); const b = Buffer.from(a.b64, 'base64'); fs.writeFileSync(docFile(a.id, a.slot), b); return { size: b.length }; },
  readDoc: (a) => { const f = docFile(a.id, a.slot); return fs.existsSync(f) ? { name: docName(a.id, a.slot), b64: fs.readFileSync(f).toString('base64') } : null; },
  // application PDFs go; the paid receipt (image + PDF) is the customer's proof and stays
  deleteDocs: (a) => { const d = vaultDir(a.id); try { for (const f of fs.readdirSync(d)) if (!f.startsWith('receipt_')) fs.rmSync(path.join(d, f), { force: true }); if (!fs.readdirSync(d).length) fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} return true; },
  saveDownload: (a) => { const p = path.join(dlDir(), a.name.replace(/[^A-Za-z0-9._-]/g, '_')); fs.writeFileSync(p, Buffer.from(a.b64, 'base64')); return { path: p, where: p }; },
  openFile: (a) => { if (a.path) shell.openPath(a.path); return true; },
  share: async (a) => {
    let saved = '';
    for (const f of a.files || []) { saved = path.join(dlDir(), f.name.replace(/[^A-Za-z0-9._-]/g, '_')); fs.writeFileSync(saved, Buffer.from(f.b64, 'base64')); }
    if (saved) shell.showItemInFolder(saved);
    if (a.whatsapp || !saved) {
      const phone = String(a.phone || '').replace(/\D/g, '');
      const url = phone.length === 10 ? `https://wa.me/91${phone}?text=${encodeURIComponent(a.text || '')}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(a.text || '')}`;
      await shell.openExternal(url);
    }
    return { note: saved ? 'File Saved: ' + saved + ' - Attach It In WhatsApp' : '' };
  },
  notify: (a) => {
    let silent = false; try { silent = JSON.parse(fs.readFileSync(dataFile(), 'utf8')).settings.sound === false; } catch (e) {}
    const n = new Notification({ title: a.title || 'VidyutSewa', body: a.body || '', silent, icon: iconPath() });
    n.on('click', () => { win.show(); win.focus(); const m = String(a.title || '').match(/(\d{8})/); if (m) event('openApp', { id: m[1] }); });
    n.show(); return true;
  },
  openExternal: (a) => { if (/^(https?|mailto|tel):/i.test(a.url)) shell.openExternal(a.url); return true; },
  openOfficial,
  clearWebSession: async () => { for (const p of ['persist:official', 'vs-ui', 'vs-css', 'vs-check']) await session.fromPartition(p).clearStorageData(); return true; },
  storageInfo: () => ({ docs: dirSize(path.join(userDir(), 'vault')), cache: dirSize(path.join(userDir(), 'Cache')) + dirSize(path.join(userDir(), 'Partitions')) }),
  clearCache: async () => { for (const p of [session.defaultSession, session.fromPartition('persist:official'), session.fromPartition('vs-ui')]) await p.clearCache(); return true; },
  appInfo: () => ({ version: app.getVersion(), platform: 'windows' }),
  theme: (a) => { try { win.setBackgroundColor(a.color || '#050A24'); } catch (e) {} return true; },
  exit: () => { win.hide(); return true; },
  biometric: () => ({ ok: false }),
  schedule: () => true
};
ipcMain.handle('vs-call', async (_e, method, args) => {
  try { const h = handlers[method]; if (!h) throw new Error('Unknown Action ' + method); return { result: await h(args || {}) }; }
  catch (e) { return { error: e.message || String(e) }; }
});

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname); if (p === '/' || !p) p = '/index.html';
    const file = path.normalize(path.join(WEB, p));
    if (!file.startsWith(WEB)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow(); createTray();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'win32' || quitting) app.quit(); });
