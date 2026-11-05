/* VidyutSewa By Yuvraj - UI (single page, shared by Android and Windows). */
(function () {
  'use strict';
  var P = window.VSParse, D = window.VSDocs;
  var t = function (s) { return window.I18N ? I18N.t(s) : s; };
  var GH = 'https://github.com/FilmyFather';
  var REPO = 'https://github.com/FilmyFather/vidyutsewa';
  var REPO_API = 'https://api.github.com/repos/FilmyFather/vidyutsewa/releases/latest';
  var LOGIN_URL = 'https://wss.mahadiscom.in/wss/wss?uiActionName=getCustAccountLogin';
  var BILL_SITE = 'https://wss.mahadiscom.in/wss/wss?uiActionName=getViewPayBill';
  var VERSION = '1.1.0';
  var DISCLAIMER = 'Independent Helper App. Not Affiliated With Or Endorsed By MSEDCL. All Applications Are Submitted And Paid On The Official MSEDCL Website.';
  var THEMES = [
    ['royal', 'Royal Electric', ['#0B1744', '#22D3EE', '#3B82F6']],
    ['emerald', 'Emerald Luxe', ['#0E3129', '#E9D3A2', '#10B981']],
    ['sunset', 'Sunset Power', ['#1A1A1E', '#FF7A18', '#F43F78']],
    ['aurora', 'Purple Aurora', ['#1A0D33', '#8B5CF6', '#D946EF']]
  ];
  var THEME_IDS = THEMES.map(function (x) { return x[0]; });
  function themeId(v) { return THEME_IDS.indexOf(v) >= 0 ? v : 'royal'; }
  var root, S = function () { return VS.state; };
  var UI = { route: 'home', params: {}, stack: [], period: 'today', appsTab: 'pending', q: '', draft: null, bill: null, locked: false, unread: 0 };
  window.UI = UI;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel) { return root.querySelector(sel); }
  function toast(msg, ms) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, ms || 2600);
  }
  UI.toast = toast;
  function ago(ts) {
    if (!ts) return t('Never');
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return t('Just Now');
    if (s < 3600) return Math.round(s / 60) + ' ' + t('Min Ago');
    if (s < 86400) return Math.round(s / 3600) + ' ' + t('Hr Ago');
    return Math.round(s / 86400) + ' ' + t('Days Ago');
  }
  function fmtDate(ts) { if (!ts) return ''; var d = new Date(ts); return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear(); }
  function left(ms) {
    if (ms <= 0) return t('Deadline Passed');
    var h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
    return (d ? d + t('d') + ' ' : '') + (h % 24) + t('h') + ' ' + Math.floor((ms % 3600000) / 60000) + t('m') + ' ' + t('Left');
  }
  function chip(st) {
    var m = { pending: ['c-p', 'Pending'], rejected: ['c-r', 'Rejected'], approved: ['c-a', 'Approved'] }[st] || ['c-c', st];
    return '<span class="chip ' + m[0] + '">' + t(m[1]) + '</span>';
  }
  function titleCase(s) { return String(s || '').toLowerCase().replace(/(^|[\s(\-\/.])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  UI.titleCase = titleCase;

  /* ---------- theme: data-theme (style) + class (dark/light) ---------- */
  function applyTheme() {
    var s = S().settings, th = s.theme;
    if (th === 'system') th = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    var de = document.documentElement;
    de.className = th === 'light' ? 'light' : 'dark';
    de.setAttribute('data-theme', themeId(s.themeStyle));
    if (window.I18N) I18N.set(s.lang);
    var pg = getComputedStyle(de).getPropertyValue('--page').trim();
    Native.call('theme', { dark: th !== 'light', color: pg }).catch(function () {});
  }
  UI.applyTheme = applyTheme;
  if (window.matchMedia) try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { applyTheme(); }); } catch (e) {}

  /* ---------- shell ---------- */
  var TABS = [['home', 'home', 'Home'], ['apps', 'apps', 'Applications'], ['bill', 'bill', 'Bill'], ['docs', 'folder', 'Documents']];
  function footer() {
    return '<div class="foot">' + t('Designed & Developed By') + ' <span class="heart">\u2665\uFE0F</span> <a onclick="UI.ext(\'' + GH + '\')">Yuvraj Chauhan</a></div>';
  }
  UI.footer = footer;
  function nav() {
    return '<nav class="nav">' + TABS.map(function (x) {
      return '<button class="' + (UI.route === x[0] ? 'on' : '') + '" onclick="UI.tab(\'' + x[0] + '\')"><span class="pill">' + icon(x[1], 22) + '</span>' + t(x[2]) + '</button>';
    }).join('') + '</nav>';
  }
  function hdrMain(title, sub) {
    return '<header class="hdr"><div class="appic"></div><div class="t"><h1>' + title + '</h1><div class="s">' + esc(sub || '') + '</div></div>' +
      '<button class="iconbtn" onclick="UI.go(\'notifs\')" aria-label="' + t('Notifications') + '">' + icon('bell', 20) + (UI.unread ? '<span class="badge">' + UI.unread + '</span>' : '') + '</button>' +
      '<button class="iconbtn gear" onclick="UI.go(\'settings\')" aria-label="' + t('Settings') + '">' + icon('gear', 20) + '</button></header>';
  }
  function hdrBack(title, sub, right) {
    return '<header class="hdr"><button class="iconbtn" onclick="UI.back()" aria-label="' + t('Back') + '">' + icon('back', 22) + '</button><div class="t"><h1>' + title + '</h1>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>' + (right || '') + '</header>';
  }
  function page(hdr, body, withNav) {
    return '<div class="screen">' + hdr + '<main class="content" id="content">' + body + '</main>' + footer() + (withNav ? nav() : '') + '</div>';
  }

  var screens = {};
  UI.screens = screens;
  function render(keepScroll) {
    var c = $('#content'), st = keepScroll && c ? c.scrollTop : 0;
    if (UI.locked) { root.innerHTML = screens.lock(); return; }
    var fn = screens[UI.route] || screens.home;
    root.innerHTML = fn(UI.params || {});
    if (keepScroll) { c = $('#content'); if (c) c.scrollTop = st; }
  }
  UI.render = render;
  UI.go = function (route, params) { UI.stack.push({ route: UI.route, params: UI.params }); UI.route = route; UI.params = params || {}; render(); };
  UI.tab = function (route) { UI.stack = []; UI.route = route; UI.params = {}; render(); };
  UI.back = function () {
    var sh = document.querySelector('.sheetwrap'); if (sh) { sh.remove(); return true; }
    if (UI.locked) { Native.call('exit').catch(function () {}); return false; }
    if (UI.stack.length) { var p = UI.stack.pop(); UI.route = p.route; UI.params = p.params; render(); return true; }
    if (UI.route !== 'home') { UI.tab('home'); return true; }
    Native.call('exit').catch(function () {});
    return false;
  };
  UI.ext = function (url) { Native.call('openExternal', { url: url }); };

  /* ---------- sheets / dialogs ---------- */
  function sheet(html, onClose) {
    var w = document.createElement('div'); w.className = 'sheetwrap';
    w.innerHTML = '<div class="sheet"><div class="grab"></div>' + html + '</div>';
    w.addEventListener('click', function (e) { if (e.target === w) { w.remove(); if (onClose) onClose(); } });
    document.body.appendChild(w); return w;
  }
  UI.sheet = sheet;
  UI.closeSheet = function () { var s = document.querySelector('.sheetwrap'); if (s) s.remove(); };
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (res) {
      var w = sheet('<h3>' + title + '</h3><div class="muted small">' + text + '</div><div class="btns2"><button class="btn out" id="cb-no">' + t('Cancel') + '</button><button class="btn ' + (danger ? 'danger' : 'pri') + '" id="cb-yes">' + (okLabel || t('Yes')) + '</button></div>', function () { res(false); });
      w.querySelector('#cb-no').onclick = function () { w.remove(); res(false); };
      w.querySelector('#cb-yes').onclick = function () { w.remove(); res(true); };
    });
  }
  UI.confirmBox = confirmBox;

  /* ---------- PDF preview ---------- */
  UI.preview = async function (id, slot, bytes, title) {
    var w = sheet('<div class="row between"><h3>' + esc(title || t('Preview')) + '</h3><button class="iconbtn" onclick="UI.closeSheet()">' + icon('x') + '</button></div><div class="pdfview" id="pv"><div class="empty"><span class="spin"></span></div></div>');
    try {
      if (!bytes) { var d = await Native.call('readDoc', { id: id, slot: slot }); if (!d) throw new Error(t('File Not Found')); bytes = D.bytesFromB64(d.b64); }
      var canv = await D.renderAll(bytes, 1100);
      var pv = w.querySelector('#pv'); pv.innerHTML = ''; canv.forEach(function (c) { pv.appendChild(c); });
    } catch (e) { w.querySelector('#pv').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; }
  };

  /* ---------- file picking + compression (compressed ONCE, on the device) ---------- */
  function pickFiles(kind, multiple) {
    return new Promise(function (res) {
      var inp = document.createElement('input'); inp.type = 'file';
      if (kind === 'camera') { inp.accept = 'image/*'; inp.setAttribute('capture', 'environment'); }
      else if (kind === 'gallery') inp.accept = 'image/*';
      else inp.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
      if (multiple) inp.multiple = true;
      inp.style.display = 'none'; document.body.appendChild(inp);
      inp.onchange = function () { var f = Array.from(inp.files || []); inp.remove(); res(f); };
      inp.click();
    });
  }
  UI.pickFiles = pickFiles;
  function slotLabel(slot) { return slot === 'agreement' ? t('Agreement') : slot === 'formx' ? 'Form X' : t('Correction PDF'); }
  function slotKey(slot) { return slot === 'agreement' ? 'Agreement' : slot === 'formx' ? 'FormX' : 'SpellingCorrection'; }
  function modeBox(holder, fn) {   // the clear choice: 1 PDF (spelling correction) or 2 PDFs (normal)
    var m = holder.mode === 'spell' ? 'spell' : 'normal';
    function opt(key, title, sub) {
      var on = m === key;
      return '<div class="card modecard ' + (on ? 'sel' : '') + '" style="margin:0" onclick="' + fn + '(\'' + key + '\')"><div class="grow"><b>' + title + '</b><div class="tiny muted">' + sub + '</div></div>' + (on ? icon('check', 20, ' style="stroke:var(--acc)"') : '') + '</div>';
    }
    return '<div class="field" id="mode-seg"><label>' + t('Application Type') + '</label><div style="display:flex;flex-direction:column;gap:8px">' +
      opt('normal', t('Normal - Agreement + Form X'), t('Agreement And Form X Are Both Mandatory.')) +
      opt('spell', t('Spelling Correction - 1 PDF'), t('Only One PDF Is Uploaded When The Reason Is A Spelling Correction.')) + '</div></div>';
  }
  async function processInto(holder, slot, file, rerender) {
    holder[slot] = { busy: true, origName: file.name };
    rerender();
    try {
      var r = await D.process(file, {});
      holder[slot] = { bytes: r.bytes, size: r.size, origSize: r.origSize, compressed: r.compressed, origName: file.name, name: slotKey(slot), skipped: r.skipped || 0, wrapped: !!r.wrapped };
      holder[slot].thumb = await D.thumb(r.bytes, 220);
    } catch (e) { holder[slot] = { err: e.message || String(e), origName: file.name }; }
    rerender();
  }
  UI.pick = async function (holderName, slot, kind) {
    var holder = UI[holderName].docs;
    var files = await pickFiles(kind, false);
    if (!files.length) return;
    var f = files[0], g = slot === 'single' ? '' : P.guessSlot(f.name);
    if (g && g !== slot && !holder[g]) { toast(t('Name Looks Like') + ' ' + slotLabel(g) + ' \u2192 ' + t('Placed There')); slot = g; }
    processInto(holder, slot, f, function () { render(true); });
  };
  UI.pickBoth = async function (holderName) {
    var holder = UI[holderName].docs;
    var files = await pickFiles('files', true);
    if (!files.length) return;
    var assign = {}, rest = [];
    files.slice(0, 4).forEach(function (f) { var g = P.guessSlot(f.name); if (g && !assign[g]) assign[g] = f; else rest.push(f); });
    ['agreement', 'formx'].forEach(function (s) { if (!assign[s] && rest.length) assign[s] = rest.shift(); });
    if (files.length > 1 && !P.guessSlot(files[0].name) && !P.guessSlot(files[1].name)) toast(t('Could Not Tell Files Apart By Name. Check And Use Swap If Needed.'), 3600);
    Object.keys(assign).forEach(function (s) { processInto(holder, s, assign[s], function () { render(true); }); });
  };
  UI.swap = function (holderName) { var h = UI[holderName].docs, a = h.agreement; h.agreement = h.formx; h.formx = a; ['agreement', 'formx'].forEach(function (s) { if (h[s]) h[s].name = s === 'agreement' ? 'Agreement' : 'FormX'; }); if (!h.agreement) delete h.agreement; if (!h.formx) delete h.formx; render(true); toast(t('Swapped')); };
  UI.clearSlot = function (holderName, slot) { delete UI[holderName].docs[slot]; render(true); };
  UI.previewDraft = function (holderName, slot) { var d = UI[holderName].docs[slot]; if (d && d.bytes) UI.preview(null, null, d.bytes, slotLabel(slot)); };

  function slotHtml(holderName, slot) {
    var d = UI[holderName].docs[slot], label = slotLabel(slot);
    var hint = slot === 'agreement' ? t('Sale Deed / Agreement / Ownership Proof') : slot === 'formx' ? t('Form X Signed By Old Consumer') : t('The One PDF For A Spelling Correction');
    var head = '<div class="row between"><div class="row">' + icon('file', 18, ' style="stroke:var(--acc)"') + '<div><b style="font-size:14px">' + label + '</b><div class="tiny muted">' + hint + '</div></div></div>';
    var hn = "'" + holderName + "','" + slot + "'";
    if (!d) return '<div class="slot">' + head + '<span class="chip c-c">' + t('Required') + '</span></div>' +
      '<div class="pickrow"><button class="btn ghost sm" onclick="UI.pick(' + hn + ',\'camera\')">' + icon('camera', 16) + t('Camera') + '</button>' +
      '<button class="btn ghost sm" onclick="UI.pick(' + hn + ',\'gallery\')">' + icon('image', 16) + t('Gallery') + '</button>' +
      '<button class="btn ghost sm" onclick="UI.pick(' + hn + ',\'files\')">' + icon('file', 16) + t('Files') + '</button></div></div>';
    if (d.busy) return '<div class="slot">' + head + '</div><div class="row small muted"><span class="spin"></span> ' + t('Compressing') + ' ' + esc(d.origName || '') + '\u2026</div></div>';
    if (d.err) return '<div class="slot">' + head + '<span class="chip c-r">' + t('Error') + '</span></div><div class="small" style="color:var(--cr)">' + esc(d.err) + '</div>' +
      '<button class="btn ghost sm" onclick="UI.clearSlot(' + hn + ')">' + icon('refresh', 16) + t('Try Again') + '</button></div>';
    return '<div class="slot done">' + head + '<span class="chip c-a">' + icon('check', 12) + ' ' + t('Ready') + '</span></div>' +
      '<div class="row"><div class="thumb" style="background-image:url(' + (d.thumb || '') + ')" onclick="UI.previewDraft(' + hn + ')"></div>' +
      '<div class="grow"><div class="small ell"><b>' + esc(d.name) + '.pdf</b></div><div class="tiny muted ell">' + esc(d.origName || '') + '</div>' +
      '<div class="small">' + (d.compressed ? D.fmtSize(d.origSize) + ' \u2192 <b class="acc">' + D.fmtSize(d.size) + '</b>' : '<b class="acc">' + D.fmtSize(d.size) + '</b> \u2022 ' + t('Not Compressed (Up To 1 MB)')) + '</div>' +
      (d.skipped ? '<div class="tiny" style="color:var(--cr)">' + t('Only First 12 Pages Kept') + '</div>' : '') +
      '<div class="row" style="margin-top:4px"><button class="btn ghost sm" onclick="UI.previewDraft(' + hn + ')">' + icon('eye', 14) + t('Preview') + '</button>' +
      '<button class="btn ghost sm" onclick="UI.clearSlot(' + hn + ')">' + icon('refresh', 14) + t('Change') + '</button></div></div></div></div>';
  }
  function docsBlock(holderName) {
    var H = UI[holderName], h = H.docs, spell = H.mode === 'spell';
    var note = '<div class="tiny muted" style="text-align:center">' + t('Files Up To 1 MB Are Not Compressed. Bigger Files Are Gently Compressed To Under 1 MB. File Names Have No Spaces.') + '</div>';
    if (spell) return slotHtml(holderName, 'single') + note;
    return '<button class="btn out sm" style="width:100%" onclick="UI.pickBoth(\'' + holderName + '\')">' + icon('sparkle', 16) + t('Pick Both Files (Auto Detect By Name)') + '</button>' +
      slotHtml(holderName, 'agreement') +
      '<div class="row" style="justify-content:center"><button class="btn ghost sm" onclick="UI.swap(\'' + holderName + '\')" ' + (h.agreement || h.formx ? '' : 'disabled') + '>' + icon('swap', 16) + t('Swap') + '</button></div>' +
      slotHtml(holderName, 'formx') + note;
  }
  function docsReady(H) { var h = H.docs, ok = function (s) { return h[s] && h[s].bytes; }; return H.mode === 'spell' ? !!ok('single') : !!(ok('agreement') && ok('formx')); }
  async function saveDocsTo(id, h, mode) {
    var out = {};
    for (var slot of P.docSlots(mode)) {
      var d = h[slot];
      var name = P.docName(id, slot);   // clean name: letters, digits, _ and - only
      var r = await Native.call('saveDoc', { id: id, slot: slot, name: name, b64: D.b64FromBytes(d.bytes) });
      out[slot] = { name: name, size: d.size, origSize: d.origSize, at: Date.now() };
    }
    return out;
  }
  UI._h = { esc: esc, page: page, hdrMain: hdrMain, hdrBack: hdrBack, chip: chip, ago: ago, left: left, fmtDate: fmtDate, sheet: sheet,
    confirmBox: confirmBox, docsBlock: docsBlock, docsReady: docsReady, saveDocsTo: saveDocsTo, pickFiles: pickFiles, $: $,
    t: t, S: S, consts: { GH: GH, REPO: REPO, REPO_API: REPO_API, LOGIN_URL: LOGIN_URL, BILL_SITE: BILL_SITE, VERSION: VERSION, DISCLAIMER: DISCLAIMER, THEMES: THEMES } };
  UI._setRoot = function (r) { root = r; };

  /* ---------- MODE SELECT (first run) ---------- */
  screens.mode = function () {
    var s = S().settings, m = UI.modePick || s.mode || 'shop';
    return '<div class="screen"><main class="content" id="content" style="justify-content:center;gap:14px;padding-top:30px">' +
      '<div style="text-align:center"><div class="appic" style="width:72px;height:72px;margin:0 auto 10px;border-radius:20px"></div><h2 style="font-size:20px">' + t('Welcome To') + ' Vidyut<span class="acc">Sewa</span></h2><div class="muted small">' + t('Choose How You Will Use The App') + '</div></div>' +
      '<div class="card modecard ' + (m === 'shop' ? 'sel' : '') + '" onclick="UI.modePick=\'shop\';UI.render(true)"><div class="big-ico">' + icon('store', 28) + '</div><div class="grow"><b>' + t('Shop Mode') + '</b><div class="small muted">' + t('For Cyber Cafe / CSC / Xerox Shops. Many Customers, Service Fee And Earnings.') + '</div></div>' + (m === 'shop' ? icon('check', 22, ' style="stroke:var(--acc)"') : '') + '</div>' +
      '<div class="card modecard ' + (m === 'personal' ? 'sel' : '') + '" onclick="UI.modePick=\'personal\';UI.render(true)"><div class="big-ico">' + icon('user', 28) + '</div><div class="grow"><b>' + t('Personal Mode') + '</b><div class="small muted">' + t('For Your Own Or Family Connection. Simple And Clean.') + '</div></div>' + (m === 'personal' ? icon('check', 22, ' style="stroke:var(--acc)"') : '') + '</div>' +
      (m === 'shop' ? '<div class="field"><label>' + t('Shop Name') + '</label><input class="inp" id="m-shop" placeholder="' + t('E.g. Yuvi Xerox & Online Services') + '" value="' + esc(s.shopName) + '"></div>' +
        '<div class="field"><label>' + t('Default Service Fee (\u20B9)') + '</label><input class="inp" id="m-fee" inputmode="numeric" value="' + esc(s.fee) + '"></div>' : '') +
      '<button class="btn pri" onclick="UI.saveMode()">' + t('Continue') + ' ' + icon('right', 18) + '</button>' +
      '<div class="tiny muted" style="text-align:center">' + t('You Can Change This Anytime In Settings.') + '</div></main>' + footer() + '</div>';
  };
  UI.saveMode = function () {
    var s = S().settings; s.mode = UI.modePick || s.mode || 'shop';
    var sh = $('#m-shop'), fe = $('#m-fee');
    if (sh) s.shopName = sh.value.trim();
    if (fe) s.fee = Math.max(0, parseInt(fe.value, 10) || 0);
    s.onboarded = true; VS.changed(); VS.schedule(); UI.tab('home');
  };

  /* ---------- LOCK ---------- */
  var pinBuf = '';
  screens.lock = function () {
    var s = S().settings;
    return '<div class="screen"><main class="content" style="justify-content:center;align-items:center;gap:12px">' +
      '<div class="appic" style="width:64px;height:64px;border-radius:18px"></div><h2 style="font-size:18px">' + t('Enter PIN') + '</h2>' +
      '<div class="pin">' + [0, 1, 2, 3].map(function (i) { return '<i class="' + (pinBuf.length > i ? 'f' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button onclick="UI.pinKey(' + n + ')">' + n + '</button>'; }).join('') +
      (s.bio && Native.platform === 'android' ? '<button onclick="UI.bio()">' + icon('finger', 24) + '</button>' : '<span></span>') +
      '<button onclick="UI.pinKey(0)">0</button><button onclick="UI.pinKey(-1)">' + icon('back', 22) + '</button></div></main>' + footer() + '</div>';
  };
  UI.pinKey = async function (n) {
    if (n === -1) pinBuf = pinBuf.slice(0, -1); else if (pinBuf.length < 4) pinBuf += n;
    render();
    if (pinBuf.length === 4) {
      var ok = (await VS.sha(pinBuf)) === S().settings.pinHash; pinBuf = '';
      if (ok) { UI.locked = false; render(); } else { toast(t('Wrong PIN')); render(); }
    }
  };
  UI.bio = async function () {
    try { var r = await Native.call('biometric', { title: 'VidyutSewa' }); if (r && r.ok) { UI.locked = false; render(); } } catch (e) { toast(e.message); }
  };

  /* ---------- HOME ---------- */
  screens.home = function () {
    var s = S().settings, st = VS.stats(UI.period), shop = s.mode === 'shop';
    var dls = S().apps.map(function (a) { return { a: a, d: VS.deadline(a) }; }).filter(function (x) { return x.d; }).sort(function (x, y) { return x.d.end - y.d.end; });
    var sub = shop ? (s.shopName || t('Shop Mode')) : t('Personal Mode');
    var body = '<div class="seg"><button class="' + (UI.period === 'today' ? 'on' : '') + '" onclick="UI.period=\'today\';UI.render(true)">' + t('Today') + '</button><button class="' + (UI.period === 'month' ? 'on' : '') + '" onclick="UI.period=\'month\';UI.render(true)">' + t('This Month') + '</button></div>' +
      '<div class="st4"><div class="card stat x"><div class="n">' + st.applied + '</div><div class="l">' + t('Applied') + '</div></div><div class="card stat p"><div class="n">' + st.pending + '</div><div class="l">' + t('Pending') + '</div></div>' +
      '<div class="card stat r"><div class="n">' + st.rejected + '</div><div class="l">' + t('Rejected') + '</div></div><div class="card stat a"><div class="n">' + st.approved + '</div><div class="l">' + t('Approved') + '</div></div></div>' +
      (shop ? '<div class="card glow row between"><div class="row"><div class="ico">' + icon('rupee', 20) + '</div><div><div class="small muted">' + t('Service Fee Earnings') + ' \u2022 ' + (UI.period === 'today' ? t('Today') : t('This Month')) + '</div><div style="font-size:22px;font-weight:700" class="acc">\u20B9' + st.earnings + '</div></div></div><div class="tiny muted" style="text-align:right">' + st.applied + ' ' + t(st.applied === 1 ? 'Customer' : 'Customers') + '</div></div>' : '') +
      '<button class="btn pri" onclick="UI.newApp()">' + icon('plus', 20) + t('New Application') + '</button>' +
      '<div class="btns2"><button class="btn out" onclick="UI.addOld()">' + icon('history', 18) + t('Add Old Application') + '</button><button class="btn ghost" onclick="UI.tab(\'bill\')">' + icon('download', 18) + t('Bill Download') + '</button></div>';
    if (dls.length) {
      body += '<div class="sec"><span class="row">' + icon('clock', 16, ' style="stroke:var(--cp)"') + t('Upload Deadlines (3 Days)') + '</span></div>';
      body += dls.slice(0, 4).map(function (x) {
        return '<div class="card row" onclick="UI.go(\'detail\',{id:\'' + x.a.id + '\'})" style="cursor:pointer"><div class="ico">' + icon('upload', 18) + '</div><div class="grow"><div class="row between"><b class="mono">' + x.a.id + '</b><span class="small countdown ' + (x.d.left < 86400000 ? 'late' : '') + '">' + left(x.d.left) + '</span></div><div class="small muted ell">' + esc(titleCase(x.a.newName) || '-') + ' \u2022 ' + t('Documents Not Uploaded') + '</div></div></div>';
      }).join('');
    }
    var pend = S().apps.filter(function (a) { return a.status !== 'approved'; }).length;
    body += '<div class="card row between"><div class="small"><div>' + t('Status Check') + ': <b>' + (s.notify ? t('Every') + ' ' + s.interval + ' ' + t('Min') : t('Off')) + '</b></div><div class="tiny muted">' + t('Last Checked') + ' ' + ago(S().lastSync) + ' \u2022 ' + pend + ' ' + t('Tracking') + '</div></div><button class="btn ghost sm" id="syncbtn" onclick="UI.sync()">' + icon('refresh', 16) + t('Check Now') + '</button></div>';
    var act = S().activity.slice(0, 6);
    body += '<div class="sec"><span>' + t('Recent Activity') + '</span>' + (S().activity.length ? '<button onclick="UI.go(\'notifs\')">' + t('View All') + '</button>' : '') + '</div>';
    body += act.length ? '<div class="card" style="padding:4px 12px">' + act.map(actRow).join('') + '</div>' : '<div class="card empty">' + icon('sparkle', 28) + '<div>' + t('No Activity Yet. Start With New Application.') + '</div></div>';
    return page(hdrMain('Vidyut<b>Sewa</b>', sub), body, true);
  };
  function actIcon(type) { return { approved: 'check', rejected: 'alert', reupload: 'upload', 'reupload-failed': 'alert', added: 'plus', deleted: 'trash', bill: 'bill', wipe: 'shield' }[type] || 'info'; }
  function actRow(a) {
    return '<div class="list-item" ' + (a.id ? 'onclick="UI.openApp(\'' + a.id + '\')" style="cursor:pointer"' : '') + '><div class="ico">' + icon(actIcon(a.type), 17) + '</div><div class="grow"><div class="small ell">' + esc(a.text) + '</div><div class="tiny muted">' + ago(a.t) + '</div></div></div>';
  }
  UI._h.actRow = actRow;
  UI.openApp = function (id) { if (VS.findApp(id)) UI.go('detail', { id: id }); };
  UI.sync = async function () {
    var b = $('#syncbtn'); if (b) b.innerHTML = '<span class="spin"></span>';
    try {
      if (!S().apps.some(function (a) { return a.status !== 'approved'; })) { toast(t('No Pending Applications To Check')); render(true); return; }
      var ev = await VS.syncAll();
      toast(ev && ev.length ? ev[0].title : t('Status Updated'));
    } catch (e) { toast(t('Could Not Check') + ': ' + e.message); }
    render(true);
  };

  /* ---------- APPLICATIONS ---------- */
  screens.apps = function () {
    var all = S().apps, q = UI.q.trim().toLowerCase();
    var cnt = { pending: 0, rejected: 0, approved: 0 };
    all.forEach(function (a) { cnt[a.status] = (cnt[a.status] || 0) + 1; });
    var list = all.filter(function (a) { return a.status === UI.appsTab; });
    if (q) list = all.filter(function (a) { return [a.id, a.newName, a.oldName, a.consumerNo, a.mobile].join(' ').toLowerCase().indexOf(q) >= 0; });
    var body = '<input class="inp" id="q" placeholder="' + t('Search ID, Name, Consumer No, Mobile') + '" value="' + esc(UI.q) + '" oninput="UI.q=this.value;UI.searchLater()">' +
      (q ? '<div class="small muted">' + list.length + ' ' + t('Results In All Applications') + '</div>' :
      '<div class="seg">' + ['pending', 'rejected', 'approved'].map(function (k) { return '<button class="' + (UI.appsTab === k ? 'on' : '') + '" onclick="UI.appsTab=\'' + k + '\';UI.render()">' + t(titleCase(k)) + ' (' + (cnt[k] || 0) + ')</button>'; }).join('') + '</div>') +
      '<div class="row between"><span class="tiny muted">' + t('Last Checked') + ' ' + ago(S().lastSync) + '</span><button class="btn ghost sm" id="syncbtn" onclick="UI.sync()">' + icon('refresh', 15) + t('Check Now') + '</button></div>';
    body += list.length ? list.map(appCard).join('') : '<div class="card empty">' + icon('apps', 30) + '<div>' + (q ? t('No Match Found') : t('No Applications Here')) + '</div>' + (!q ? '<div class="row" style="justify-content:center;margin-top:10px"><button class="btn pri sm" onclick="UI.newApp()">' + icon('plus', 15) + t('New Application') + '</button><button class="btn out sm" onclick="UI.addOld()">' + t('Add Old Application') + '</button></div>' : '') + '</div>';
    return page(hdrMain(t('Applications'), all.length + ' ' + t('Saved On This Device')), body, true);
  };
  var sTimer; UI.searchLater = function () { clearTimeout(sTimer); sTimer = setTimeout(function () { render(true); var i = $('#q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); };
  function appCard(a) {
    var dl = VS.deadline(a);
    return '<div class="card appcard" onclick="UI.go(\'detail\',{id:\'' + a.id + '\'})"><div class="top"><span class="id mono">' + a.id + '</span>' + chip(a.status) + '</div>' +
      '<div class="row between"><div class="grow"><div class="ell" style="font-weight:600">' + esc(titleCase(a.newName) || t('Name Not Loaded')) + '</div><div class="small muted mono ell">' + t('Consumer No') + ' ' + esc(a.consumerNo || '-') + (a.mobile ? ' \u2022 ' + esc(a.mobile) : '') + '</div></div>' + icon('right', 18, ' style="stroke:var(--mut)"') + '</div>' +
      '<div class="row between tiny muted"><span class="row" style="gap:4px">' + icon('clock', 12) + t('Checked') + ' ' + ago(a.lastChecked) + '</span><span class="row" style="gap:4px">' + icon('file', 12) + t('Docs') + ' ' + (a.docsUploaded == null ? '-' : a.docsUploaded) + (VS.hasDocs(a) ? ' \u2022 ' + t('PDFs Saved') : '') + '</span></div>' +
      (a.rawStatus ? '<div class="tiny ell" style="color:var(--acc)">' + esc(a.rawStatus) + '</div>' : '') +
      (dl ? '<div class="tiny countdown ' + (dl.left < 86400000 ? 'late' : '') + '">' + t('Upload') + ': ' + left(dl.left) + '</div>' : '') +
      (a.reuploadState === 'failed' ? '<div class="tiny" style="color:var(--cr)">' + t('Auto Re-Upload Failed') + '</div>' : '') + '</div>';
  }

  /* ---------- DETAIL ---------- */
  screens.detail = function (p) {
    var a = VS.findApp(p.id); if (!a) return page(hdrBack(t('Application')), '<div class="empty">' + t('Not Found') + '</div>');
    var shop = S().settings.mode === 'shop', bad = a.status === 'rejected';
    var steps = [
      { k: 'Application Submitted', done: true, sub: a.applicationDate || fmtDate(a.appliedAt || a.addedAt) },
      { k: 'Documents Uploaded', done: a.docsUploaded >= VS.needDocs(a), sub: a.docsUploaded != null ? a.docsUploaded + ' ' + t('Documents On Official Site') : t('Not Checked Yet') },
      { k: 'Fee Paid', done: !!a.receiptNo, sub: a.receiptNo ? t('Receipt') + ' ' + a.receiptNo : t('Pending') },
      { k: bad ? 'Rejected' : 'Approved', done: a.status === 'approved', bad: bad, sub: a.status === 'approved' ? fmtDate(a.approvedAt) : (bad ? (a.rawStatus || '') : t('Waiting')) }
    ];
    var body = '<div class="card glow"><div class="row between"><span class="mono" style="font-size:20px;font-weight:700">' + a.id + '</span>' + chip(a.status) + '</div>' +
      '<div class="small" style="margin-top:4px;color:var(--acc)">' + esc(a.rawStatus || t('Status Not Checked Yet')) + '</div>' +
      '<div class="grid2" style="margin-top:10px"><div class="kv">' + t('New Name') + '<br><b>' + esc(titleCase(a.newName) || '-') + '</b></div><div class="kv">' + t('Old Name') + '<br><b>' + esc(titleCase(a.oldName) || '-') + '</b></div>' +
      '<div class="kv">' + t('Consumer No') + '<br><b class="mono">' + esc(a.consumerNo || '-') + '</b></div><div class="kv">' + t('Mobile') + '<br><b class="mono">' + esc(a.mobile || '-') + '</b></div>' +
      (a.reason ? '<div class="kv">' + t('Reason') + '<br><b>' + esc(a.reason) + '</b></div>' : '') + '<div class="kv">' + t('Last Checked') + '<br><b>' + ago(a.lastChecked) + '</b></div></div>' +
      (a.lastError ? '<div class="tiny" style="color:var(--cr);margin-top:6px">' + esc(a.lastError) + '</div>' : '') + '</div>';
    if (a.reuploadState === 'failed') body += '<div class="warn">' + icon('alert', 16) + '<div><b>' + t('Auto Re-Upload Failed') + '</b><br>' + esc(a.reuploadError || '') + '. ' + t('Tap Re-Upload To Upload On The Official Page.') + '</div></div>';
    var dl = VS.deadline(a);
    if (dl) body += '<div class="warn">' + icon('clock', 16) + '<div>' + t('Upload Documents Within 3 Days Of Applying') + ': <b class="countdown ' + (dl.left < 86400000 ? 'late' : '') + '">' + left(dl.left) + '</b></div></div>';
    body += '<div class="sec">' + t('Status Timeline') + '</div><div class="card"><div class="timeline">' + steps.map(function (s, i) {
      return '<div class="tl ' + (s.done ? 'done' : '') + (s.bad ? ' bad' : '') + '"><div class="dot"><i></i>' + (i < steps.length - 1 ? '<b></b>' : '') + '</div><div class="txt"><b>' + t(s.k) + '</b><span>' + esc(s.sub || '') + '</span></div></div>';
    }).join('') + '</div></div>';
    body += '<div class="card"><div class="row between"><span class="muted small">' + t('Processing Fee') + '</span><b>' + (a.fee ? '\u20B9' + esc(a.fee) : '-') + '</b></div>' +
      '<div class="row between" style="margin-top:6px"><span class="muted small">' + t('Receipt No') + '</span><b class="mono small">' + esc(a.receiptNo || '-') + '</b></div>' +
      (a.receiptDate ? '<div class="row between" style="margin-top:6px"><span class="muted small">' + t('Receipt Date') + '</span><span class="small">' + esc(a.receiptDate) + '</span></div>' : '') +
      (shop ? '<div class="row between" style="margin-top:6px"><span class="muted small">' + t('Service Fee') + '</span><b class="acc">\u20B9' + esc(a.serviceFee || 0) + '</b></div>' : '') + '</div>';
    body += '<div class="sec">' + t('Saved PDFs') + '</div><div class="card" style="padding:4px 12px">' +
      '<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--bd)"><div><div class="tiny muted">' + t('Application Type') + '</div><b class="small">' + (VS.docMode(a) === 'spell' ? t('Spelling Correction - 1 PDF') : t('Normal - Agreement + Form X')) + '</b></div>' +
      '<button class="btn ghost sm" onclick="UI.toggleType(\'' + a.id + '\')">' + icon('swap', 14) + t('Change Type') + '</button></div>';
    if (a.docsDeleted && !VS.hasDocs(a)) body += '<div class="list-item small muted">' + icon('trash', 16) + ' ' + t('Deleted Permanently After Approval') + '</div>';
    else VS.docSlots(a).forEach(function (slot) {
      var d = a.docs && a.docs[slot];
      body += '<div class="list-item"><div class="ico">' + icon('file', 17) + '</div><div class="grow"><div class="small ell"><b>' + (d ? esc(d.name) : slotLabel(slot)) + '</b></div><div class="tiny muted">' + (d ? D.fmtSize(d.size) : t('Not Saved')) + '</div></div>' +
        (d ? '<button class="btn ghost sm" onclick="UI.preview(\'' + a.id + '\',\'' + slot + '\',null,\'' + esc(d.name) + '\')">' + icon('eye', 14) + '</button>' : '') +
        '<button class="btn ghost sm" onclick="UI.replaceDoc(\'' + a.id + '\',\'' + slot + '\')">' + icon(d ? 'refresh' : 'plus', 14) + '</button></div>';
    });
    body += '</div>';
    body += (UI.receiptCard ? UI.receiptCard(a) : '');
    body += '<div class="btns2"><button class="btn pri" onclick="UI.reupload(\'' + a.id + '\')">' + icon('upload', 18) + t('Re-Upload') + '</button><button class="btn wa" onclick="UI.shareApp(\'' + a.id + '\')">' + icon('wa', 18) + t('Share On WhatsApp') + '</button></div>' +
      '<div class="btns2"><button class="btn out" onclick="UI.officialStatus(\'' + a.id + '\')">' + icon('ext', 17) + t('Open Official Status') + '</button><button class="btn ghost" id="chk1" onclick="UI.checkOne(\'' + a.id + '\')">' + icon('refresh', 17) + t('Check Now') + '</button></div>' +
      (a.status === 'approved' ? '<button class="btn pri" onclick="UI.cert(\'' + a.id + '\')">' + icon('cert', 18) + t('Download Provisional Certificate') + '</button>' : '') +
      '<button class="btn danger sm" style="width:100%;margin-top:4px" onclick="UI.delApp(\'' + a.id + '\')">' + icon('trash', 15) + t('Delete From App') + '</button>';
    return page(hdrBack(t('Application Details'), esc(titleCase(a.newName) || '')), body, false);
  };
  UI.checkOne = async function (id) {
    var a = VS.findApp(id), b = $('#chk1'); if (b) b.innerHTML = '<span class="spin"></span>';
    try {
      if (Native.platform === 'android') { await Native.call('syncNow', { id: id }); await VS.load(); }
      else { var ev = await VS.checkApp(a); ev.forEach(function (n) { if (S().settings.notify) Native.call('notify', { title: n.title, body: n.body }); }); }
      a = VS.findApp(id); toast(t('Status') + ': ' + (a && a.rawStatus || t('Updated')));
    } catch (e) { toast(t('Could Not Check') + ': ' + e.message); }
    VS.changed(); render(true);
  };
  UI.toggleType = async function (id) {
    var a = VS.findApp(id), to = VS.docMode(a) === 'spell' ? 'normal' : 'spell';
    var msg = to === 'spell' ? t('Only One PDF Will Be Needed. Saved Agreement And Form X Stay In The Vault Until You Delete Them.') : t('Agreement And Form X Will Both Be Needed. Add The Missing Ones.');
    if (!(await confirmBox(t('Change Application Type?'), msg, t('Change')))) return;
    a.docMode = to; VS.log('type', 'Type Changed - ' + a.id, a.id); VS.changed(); render(true);
  };
  UI.replaceDoc = async function (id, slot) {
    var files = await pickFiles('files', false); if (!files.length) return;
    toast(t('Compressing') + '\u2026');
    try {
      var r = await D.process(files[0], {});
      var a = VS.findApp(id), name = P.docName(id, slot);
      await Native.call('saveDoc', { id: id, slot: slot, name: name, b64: D.b64FromBytes(r.bytes) });
      a.docs = a.docs || {}; a.docs[slot] = { name: name, size: r.size, origSize: r.origSize, at: Date.now() }; a.docsDeleted = false;
      VS.changed(); render(true); toast(t('Saved') + ' ' + D.fmtSize(r.size));
    } catch (e) { toast(e.message); }
  };
  UI.reupload = function (id) {
    var a = VS.findApp(id);
    sheet('<h3>' + t('Re-Upload Documents') + '</h3><div class="small muted">' + (VS.docMode(a) === 'spell' ? t('The Official Upload Page Opens Inside The App. When It Asks For A File, Your Saved Correction PDF Is Offered First.') : t('The Official Upload Page Opens Inside The App. When It Asks For A File, Your Saved Agreement And Form X Are Offered First.')) + '</div>' +
      '<button class="btn pri" onclick="UI.closeSheet();UI.official(\'' + P.statusUrl(id) + '\',\'' + id + '\')">' + icon('ext', 17) + t('Open Upload Page') + '</button>' +
      (VS.hasDocs(a) ? '<button class="btn ghost" onclick="UI.autoUp(\'' + id + '\')">' + icon('zap', 17) + t('Try Automatic Re-Upload') + '</button><div class="tiny muted">' + t('Automatic Re-Upload Is Experimental And May Need The Official Page.') + '</div>' : ''));
  };
  UI.autoUp = async function (id) {
    UI.closeSheet(); toast(t('Re-Uploading Document') + ' - ' + id, 4000);
    try {
      var ev;
      if (Native.platform === 'android') { var r = await Native.call('reuploadNow', { id: id }); await VS.load(); ev = (r && r.events) || []; }
      else { ev = await VS.reupload(VS.findApp(id)); VS.changed(); ev.forEach(function (n) { Native.call('notify', { title: n.title, body: n.body }); }); }
      var last = ev[ev.length - 1]; toast(last ? last.title + (last.body ? ' - ' + last.body : '') : t('Done'), 5000);
    } catch (e) { toast(e.message, 4000); }
    render(true);
  };
  UI.shareApp = function (id) {
    var a = VS.findApp(id), s = S().settings;
    var tpl = (!s.waTemplate || s.waTemplate === VS.OLD_TEMPLATE) ? VS.DEFAULT_TEMPLATE : s.waTemplate;
    var text = P.fillTemplate(tpl, { type: t(VS.typeLabel(a)), name: titleCase(a.newName) || '', id: a.id, shopName: s.shopName || 'VidyutSewa', consumerNo: a.consumerNo, status: a.rawStatus });
    Native.call('share', { text: text, whatsapp: true, phone: a.mobile || '' }).then(function (r) { if (r && r.note) toast(r.note, 4500); }).catch(function (e) { toast(e.message); });
  };
  UI.officialStatus = function (id) { UI.official(P.statusUrl(id), id); };
  UI.cert = function (id) {
    var a = VS.findApp(id);
    if (a.certUrl) UI.official(a.certUrl, id); else { toast(t('Opening Official Page. Use Its Print / Certificate Button.'), 3500); UI.official(P.statusUrl(id), id); }
  };
  UI.delApp = async function (id) {
    if (!(await confirmBox(t('Delete Application?'), t('This Removes It And Its Saved PDFs From This Device Only. Nothing Changes On The Official Site.'), t('Delete'), true))) return;
    await VS.removeApp(id); VS.changed(); UI.back(); toast(t('Deleted'));
  };

  /* ---------- official site (in-app WebView / window) ---------- */
  UI.official = async function (url, id, mode) {
    try {
      var r = await Native.call('openOfficial', { url: url, appId: id || '', mode: mode || '' });
      if (r && r.applicationId) UI.onCapturedId(r.applicationId);
    } catch (e) { toast(e.message); }
  };
  Native.on('applicationId', function (d) { if (d && d.id) UI.onCapturedId(d.id); });
  UI.onCapturedId = function (id) {
    if (!P.validAppId(id)) return;
    if (UI.draft && UI.route === 'newapp') { UI.draft.appId = id; UI.draft.step = 3; render(true); toast(t('Application ID Captured') + ': ' + id, 4000); }
    else toast(t('Application ID Seen') + ': ' + id, 4000);
  };

  /* ---------- NEW APPLICATION ---------- */
  UI.newApp = function () {
    UI.draft = UI.draft && !UI.draft.saved ? UI.draft : { step: 1, mode: 'normal', name: '', cno: '', mobile: '', fee: S().settings.fee, checks: {}, docs: {}, appId: '' };
    UI.go('newapp');
  };
  var CHECKS = ['Agreement / Ownership Proof Ready', 'Form X Signed By Old Consumer', 'Registered Mobile Available For OTP', 'WSS Login Name And Password Ready (Or Register First)'];
  var CHECKS_SPELL = ['Spelling Correction PDF Ready', 'Registered Mobile Available For OTP', 'WSS Login Name And Password Ready (Or Register First)'];
  function checksFor(mode) { return mode === 'spell' ? CHECKS_SPELL : CHECKS; }
  UI.setDraftMode = function (m) { readNa1(); UI.draft.mode = m; UI.draft.checks = {}; render(true); };
  screens.newapp = function () {
    var d = UI.draft, shop = S().settings.mode === 'shop';
    var body = '<div class="steps">' + [1, 2, 3].map(function (i) { return '<i class="' + (d.step >= i ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    if (d.step === 1) {
      body += '<div class="sec">' + t('Step 1: Customer & Checklist') + '</div>' +
        '<div class="field"><label>' + t('New Consumer Name') + '</label><input class="inp" id="na-name" value="' + esc(d.name) + '" placeholder="' + t('Full Name As On Documents') + '"></div>' +
        '<div class="field"><label>' + t('Consumer Number (12 Digits)') + '</label><input class="inp mono" id="na-cno" inputmode="numeric" maxlength="12" value="' + esc(d.cno) + '"></div>' +
        '<div class="field"><label>' + t('Customer Mobile (For WhatsApp, Optional)') + '</label><input class="inp mono" id="na-mob" inputmode="tel" maxlength="10" value="' + esc(d.mobile) + '"></div>' +
        (shop ? '<div class="field"><label>' + t('Service Fee (\u20B9)') + '</label><input class="inp" id="na-fee" inputmode="numeric" value="' + esc(d.fee) + '"></div>' : '') +
        modeBox(d, 'UI.setDraftMode') +
        '<div class="card">' + checksFor(d.mode).map(function (c, i) { return '<div class="check ' + (d.checks[i] ? 'on' : '') + '" onclick="UI.toggleCheck(' + i + ')"><span class="box">' + (d.checks[i] ? icon('check', 14) : '') + '</span><span>' + t(c) + '</span></div>'; }).join('') + '</div>' +
        '<button class="btn pri" onclick="UI.naNext1()">' + t('Next: Documents') + ' ' + icon('right', 18) + '</button>';
    } else if (d.step === 2) {
      body += '<div class="sec">' + t('Step 2: Documents') + '</div>' + docsBlock('draft') +
        '<div class="btns2"><button class="btn out" onclick="UI.draft.step=1;UI.render()">' + icon('back', 17) + t('Back') + '</button><button class="btn pri" ' + (docsReady(d) ? '' : 'disabled') + ' onclick="UI.naConfirmDocs()">' + t('Confirm') + ' ' + icon('check', 17) + '</button></div>';
    } else {
      body += '<div class="sec">' + t('Step 3: Apply On Official Site') + '</div>' +
        '<div class="card"><div class="kv">' + t('New Consumer Name') + ': <b>' + esc(d.name || '-') + '</b></div><div class="kv">' + t('Consumer No') + ': <b class="mono">' + esc(d.cno || '-') + '</b></div>' +
        '<div class="kv">' + t('Type') + ': <b>' + (d.mode === 'spell' ? t('Spelling Correction - 1 PDF') : t('Normal - Agreement + Form X')) + '</b></div>' +
        '<div class="kv">' + t('Documents') + ': <b>' + (d.mode === 'spell' ? t('Correction PDF') + ' ' + D.fmtSize(d.docs.single.size) : t('Agreement') + ' ' + D.fmtSize(d.docs.agreement.size) + ' \u2022 Form X ' + D.fmtSize(d.docs.formx.size)) + '</b></div></div>' +
        '<div class="card small"><b>' + t('On The Official Site') + ':</b><div class="muted" style="margin-top:4px;line-height:1.6">1. ' + t('Login (Login Name, Password, Captcha, OTP)') + '<br>2. ' + t('My Account \u2192 Select Consumer \u2192 Change Of Name') + '<br>3. ' + t('Fill New Name, Reason, OTP \u2192 Submit') + '<br>4. ' + t('Note The Application ID (The App Tries To Catch It)') + '<br>5. ' + t('Upload Documents (Your Saved PDFs Are Offered) And Pay Fee') + '</div>' +
        '<div class="tiny acc" style="margin-top:6px">' + t('You Type Captcha And OTP Yourself. Payment Happens Only On The Official Site.') + '</div></div>' +
        '<button class="btn pri" onclick="UI.naOpenSite()">' + icon('ext', 18) + t('Open Official Site To Apply') + '</button>' +
        '<div class="field"><label>' + t('Application ID (8 Digits)') + '</label><input class="inp mono" id="na-id" inputmode="numeric" maxlength="8" value="' + esc(d.appId) + '" placeholder="' + t('Captured Automatically Or Type Here') + '"></div>' +
        '<button class="btn pri" onclick="UI.naSave()">' + icon('check', 18) + t('Save Application') + '</button>' +
        '<button class="btn out sm" style="width:100%" onclick="UI.draft.step=2;UI.render()">' + icon('back', 15) + t('Back To Documents') + '</button>';
    }
    return page(hdrBack(t('New Application'), t('Step') + ' ' + d.step + ' / 3'), body, false);
  };
  UI.toggleCheck = function (i) { readNa1(); UI.draft.checks[i] = !UI.draft.checks[i]; render(true); };
  function readNa1() {
    var d = UI.draft, g = function (id) { var e = $(id); return e ? e.value.trim() : null; };
    var v; if ((v = g('#na-name')) !== null) d.name = v; if ((v = g('#na-cno')) !== null) d.cno = v.replace(/\D/g, '');
    if ((v = g('#na-mob')) !== null) d.mobile = v.replace(/\D/g, ''); if ((v = g('#na-fee')) !== null) d.fee = parseInt(v, 10) || 0;
  }
  UI.naNext1 = function () {
    readNa1(); var d = UI.draft;
    if (d.cno && !P.validConsumerNo(d.cno)) return toast(t('Consumer Number Must Be 12 Digits'));
    if (checksFor(d.mode).some(function (c, i) { return !d.checks[i]; })) toast(t('Tip: Keep All Checklist Items Ready Before Applying'), 3000);
    d.step = 2; render();
  };
  UI.naConfirmDocs = async function () {
    var d = UI.draft;
    var spell = d.mode === 'spell';
    if (!(await confirmBox(t('Confirm Documents'), (spell ? t('Correction PDF') + ': ' + D.fmtSize(d.docs.single.size) + '<br><br>' + t('Is The File Correct And Readable?') : t('Agreement') + ': ' + D.fmtSize(d.docs.agreement.size) + '<br>Form X: ' + D.fmtSize(d.docs.formx.size) + '<br><br>' + t('Are Both Files Correct And Readable?')), t('Yes, Correct')))) return;
    try { await saveDocsTo('draft', d.docs, d.mode); } catch (e) { return toast(e.message); }
    d.step = 3; render();
  };
  UI.naOpenSite = function () { var e = $('#na-id'); if (e) UI.draft.appId = e.value.trim(); UI.official(LOGIN_URL, 'draft', 'apply'); };
  UI.naSave = async function () {
    var d = UI.draft, e = $('#na-id'); if (e) d.appId = e.value.trim();
    if (!P.validAppId(d.appId)) return toast(t('Enter The 8-Digit Application ID'));
    if (VS.findApp(d.appId) && !(await confirmBox(t('Already Saved'), t('This Application ID Is Already In The App. Replace It?'), t('Replace')))) return;
    try {
      var docs = await saveDocsTo(d.appId, d.docs, d.mode);
      await Native.call('deleteDocs', { id: 'draft' }).catch(function () {});
      var a = { id: d.appId, newName: d.name.toUpperCase(), consumerNo: d.cno, mobile: d.mobile, status: 'pending', rawStatus: '', addedAt: Date.now(), appliedAt: Date.now(),
        serviceFee: S().settings.mode === 'shop' ? d.fee : 0, docs: docs, docMode: d.mode === 'spell' ? 'spell' : 'normal', history: [{ t: Date.now(), text: 'Saved In App' }], source: 'new' };
      VS.upsertApp(a); VS.log('added', 'New Application Saved - ' + a.id, a.id); VS.changed();
      d.saved = true; UI.draft = null;
      UI.stack = []; UI.route = 'detail'; UI.params = { id: a.id }; render();
      toast(t('Saved. Checking Status\u2026'));
      UI.checkOne(a.id);
    } catch (err) { toast(err.message); }
  };

  /* ---------- ADD OLD APPLICATION ---------- */
  UI.addOld = function () { UI.old = { id: '', ver: null, mode: 'normal', docs: {}, mobile: '', fee: S().settings.fee }; UI.go('addold'); };
  screens.addold = function () {
    var o = UI.old, shop = S().settings.mode === 'shop', v = o.ver;
    var body = '<div class="field"><label>' + t('Application ID (8 Digits)') + '</label><div class="inprow"><input class="inp mono" id="ao-id" inputmode="numeric" maxlength="8" value="' + esc(o.id) + '" placeholder="12345678"><button class="btn pri sm" id="ao-v" onclick="UI.verifyOld()" style="min-width:96px">' + t('Verify') + '</button></div></div>';
    if (v) {
      body += '<div class="card glow"><div class="row between"><b class="mono" style="font-size:17px">' + esc(v.applicationId) + '</b>' + chip(v.status) + '</div>' +
        '<div class="grid2" style="margin-top:8px"><div class="kv">' + t('New Name') + '<br><b>' + esc(titleCase(v.newName)) + '</b></div><div class="kv">' + t('Consumer No') + '<br><b class="mono">' + esc(v.consumerNo) + '</b></div>' +
        '<div class="kv">' + t('Old Name') + '<br><b>' + esc(titleCase(v.oldName)) + '</b></div><div class="kv">' + t('Documents Uploaded') + '<br><b>' + (v.docsUploaded == null ? '-' : v.docsUploaded) + '</b></div></div>' +
        '<div class="tiny acc" style="margin-top:6px">' + esc(v.rawStatus) + '</div></div>' +
        '<div class="field"><label>' + t('Customer Mobile (For WhatsApp, Optional)') + '</label><input class="inp mono" id="ao-mob" inputmode="tel" maxlength="10" value="' + esc(o.mobile || v.mobile || '') + '"></div>' +
        (shop ? '<div class="field"><label>' + t('Service Fee (\u20B9)') + '</label><input class="inp" id="ao-fee" inputmode="numeric" value="' + esc(o.fee) + '"></div>' : '') +
        modeBox(o, 'UI.setOldMode') + '<div class="sec">' + (o.mode === 'spell' ? t('One PDF Is Mandatory') : t('Both PDFs Are Mandatory')) + '</div>' + docsBlock('old') +
        '<button class="btn pri" ' + (docsReady(o) ? '' : 'disabled') + ' onclick="UI.saveOld()">' + icon('check', 18) + t('Save Application') + '</button>';
    } else body += '<div class="card small muted">' + t('Enter An Application ID You Already Applied For. The App Reads Its Status From The Official Site, Then You Attach Both PDFs So It Can Re-Upload If Needed.') + '</div>';
    return page(hdrBack(t('Add Old Application')), body, false);
  };
  UI.setOldMode = function (m) { var mm = $('#ao-mob'), ff = $('#ao-fee'); if (mm) UI.old.mobile = mm.value; if (ff) UI.old.fee = ff.value; UI.old.mode = m; render(true); };
  UI.verifyOld = async function () {
    var o = UI.old; o.id = ($('#ao-id').value || '').trim();
    if (!P.validAppId(o.id)) return toast(t('Enter The 8-Digit Application ID'));
    $('#ao-v').innerHTML = '<span class="spin"></span>';
    try {
      var p = await VS.fetchStatus(o.id);
      if (!p.found) { o.ver = null; toast(t('Application Not Found On Official Site')); }
      else { o.ver = p; if (/spell|correct/i.test(p.reason || '')) o.mode = 'spell'; }   // the site's own reason pre-selects the type; the choice stays visible
    } catch (e) { toast(t('Could Not Reach Official Site') + ': ' + e.message); }
    render(true);
  };
  UI.saveOld = async function () {
    var o = UI.old, v = o.ver, m = $('#ao-mob'), f = $('#ao-fee');
    if (!docsReady(o)) return toast(o.mode === 'spell' ? t('Attach The PDF First') : t('Attach Both PDFs First'));
    try {
      var id = v.applicationId || o.id;
      var docs = await saveDocsTo(id, o.docs, o.mode);
      var a = { id: id, status: v.status, addedAt: Date.now(), lastChecked: Date.now(), mobile: m ? m.value.replace(/\D/g, '') : '',
        serviceFee: S().settings.mode === 'shop' && f ? (parseInt(f.value, 10) || 0) : 0, docs: docs, docMode: o.mode === 'spell' ? 'spell' : 'normal', history: [{ t: Date.now(), text: v.rawStatus || 'Added' }], source: 'old' };
      VS.applyParsed(a, v); if (!a.appliedAt) a.appliedAt = Date.now();
      if (!a.mobile && v.mobile) a.mobile = v.mobile;
      VS.upsertApp(a); VS.log('added', 'Old Application Added - ' + a.id, a.id); VS.changed();
      UI.stack = []; UI.route = 'detail'; UI.params = { id: a.id }; render(); toast(t('Application Saved'));
    } catch (e) { toast(e.message); }
  };

  /* ---------- BILL ---------- */
  screens.bill = function () {
    var b = UI.bill, recent = S().bills.slice(0, 8);
    var body = '<div class="card"><div class="field"><label>' + t('Consumer Number (12 Digits)') + '</label><div class="inprow"><input class="inp mono" id="b-cno" inputmode="numeric" maxlength="12" value="' + esc(UI.billCno || '') + '" placeholder="000000000000" onkeydown="if(event.key===\'Enter\')UI.getBill()"><button class="btn pri sm" id="b-go" style="min-width:96px" onclick="UI.getBill()">' + t('Get Bill') + '</button></div></div>' +
      '<div class="tiny muted" style="margin-top:6px">' + t('No Login, No OTP. Original MSEDCL Bill PDF.') + '</div></div>';
    if (recent.length) body += '<div class="recent">' + recent.map(function (r) { return '<button onclick="UI.billCno=\'' + r.cno + '\';UI.getBill()">' + esc(r.cno) + (r.name ? ' \u2022 ' + esc(titleCase(r.name).split(' ')[0]) : '') + '</button>'; }).join('') + '</div>';
    if (b && b.ok) {
      var latest = b.latestMonth || b.billMonth, months = [latest].concat(P.prevMonths(latest, 6));
      body += '<div class="card glow"><div class="row between"><div class="grow"><div style="font-weight:700" class="ell">' + esc(titleCase(b.name)) + '</div><div class="small muted mono ell">' + esc(b.consumerNo) + ' \u2022 BU ' + esc(b.billingUnit) + (b.billingUnitName ? ' ' + esc(titleCase(b.billingUnitName)) : '') + '</div></div><span class="chip c-c">' + esc(b.billMonthLabel) + '</span></div>' +
        '<div class="row between" style="margin-top:10px;align-items:flex-end"><div><div class="tiny muted">' + t('Bill Amount') + '</div><div class="billamt">\u20B9' + esc(b.amount) + '</div></div><div style="text-align:right"><div class="tiny muted">' + t('Due Date') + '</div><b>' + esc(b.dueDate) + '</b></div></div>' +
        '<div class="grid2" style="margin-top:10px"><div class="kv">' + t('Units Consumed') + '<br><b>' + esc(b.units) + '</b></div><div class="kv">' + t('Bill Date') + '<br><b>' + esc(b.billDate) + '</b></div>' +
        '<div class="kv">' + t('After Due Date') + '<br><b>\u20B9' + esc(b.afterDueAmount || '-') + '</b></div><div class="kv">' + t('Prompt Payment Discount') + '<br><b>' + (b.promptDiscount ? '\u20B9' + esc(b.promptDiscount) : '-') + '</b>' + (b.promptPayAmount ? '<br><span class="tiny">' + t('Pay') + ' \u20B9' + esc(b.promptPayAmount) + (b.promptPayDate ? ' ' + t('By') + ' ' + esc(b.promptPayDate) : '') + '</span>' : '') + '</div></div></div>' +
        '<button class="btn pri" id="b-dl" onclick="UI.billPdf(false)" ' + (b.pdfUrl ? '' : 'disabled') + '>' + icon('download', 18) + t('Download Original Bill PDF') + '</button>' +
        '<div class="btns2"><button class="btn wa" id="b-sh" onclick="UI.billPdf(true)" ' + (b.pdfUrl ? '' : 'disabled') + '>' + icon('wa', 18) + t('Share On WhatsApp') + '</button><button class="btn out" onclick="UI.ext(\'' + BILL_SITE + '\')">' + icon('ext', 17) + t('Official Site') + '</button></div>' +
        '<div class="sec">' + t('Previous Months') + '</div><div class="monthchips">' + months.map(function (m) { return '<button class="' + (m === b.billMonth ? 'on' : '') + '" onclick="UI.getBill(\'' + m + '\')">' + P.yymmLabel(m) + '</button>'; }).join('') + '</div>';
    } else if (b && !b.ok) body += '<div class="card empty">' + icon('alert', 28) + '<div>' + esc(t(b.error)) + '</div><button class="btn out sm" style="margin:10px auto 0" onclick="UI.ext(\'' + BILL_SITE + '\')">' + icon('ext', 15) + t('Try On Official Site') + '</button></div>';
    else body += '<div class="card empty">' + icon('bill', 32) + '<div>' + t('Enter A Consumer Number To See The Latest Bill') + '</div></div>';
    return page(hdrMain(t('Bill Download'), t('Original MSEDCL Bill PDF')), body, true);
  };
  UI.getBill = async function (month) {
    var inp = $('#b-cno'); if (inp && !month) UI.billCno = inp.value.replace(/\D/g, '');
    var cno = UI.billCno;
    if (!P.validConsumerNo(cno)) return toast(t('Consumer Number Must Be 12 Digits'));
    var go = $('#b-go'); if (go) go.innerHTML = '<span class="spin"></span>';
    try {
      var latest = UI.bill && UI.bill.ok && UI.bill.consumerNo === cno ? (UI.bill.latestMonth || UI.bill.billMonth) : '';
      var req = month && month !== latest ? month : '';
      var b = await VS.fetchBill(cno, req);
      if (b.ok) {
        b.latestMonth = latest || b.billMonth; b.reqMonth = req;
        var bills = S().bills.filter(function (x) { return x.cno !== cno; }); bills.unshift({ cno: cno, name: b.name, at: Date.now() });
        S().bills = bills.slice(0, 20); VS.changed();
      }
      UI.bill = b;
    } catch (e) { UI.bill = { ok: false, error: t('Could Not Reach Bill Server') + ': ' + e.message }; }
    render(true);
  };
  UI.billPdf = async function (share) {
    var b = UI.bill, btn = $(share ? '#b-sh' : '#b-dl'); if (btn) btn.innerHTML = '<span class="spin"></span> ' + t('Fetching Original PDF') + '\u2026';
    try {
      var fresh = await VS.fetchBill(b.consumerNo, b.reqMonth || '');   // the PDF token may expire: always refresh first
      if (!fresh.ok || !fresh.pdfUrl) throw new Error(fresh.error || t('Bill PDF Not Available'));
      var r = await Native.call('http', { url: fresh.pdfUrl, responseType: 'base64', headers: { 'User-Agent': VS.UA } });
      if (!r || r.status >= 400 || !r.body) throw new Error(t('Bill PDF Download Failed'));
      var name = 'MSEDCL_Bill_' + b.consumerNo + '_' + (fresh.billMonth || '') + '.pdf';
      if (share) {
        var shr = await Native.call('share', { text: 'MSEDCL Bill ' + fresh.billMonthLabel + ' - ' + titleCase(fresh.name) + ' - Rs ' + fresh.amount + ' - Due ' + fresh.dueDate, whatsapp: true, files: [{ name: name, b64: r.body, mime: 'application/pdf' }] });
        if (shr && shr.note) toast(shr.note, 4500);
      } else {
        var s = await Native.call('saveDownload', { name: name, b64: r.body, mime: 'application/pdf' });
        toast(t('Saved') + ': ' + ((s && s.where) || name), 3500);
        if (s && (s.path || s.uri)) Native.call('openFile', { path: s.path, uri: s.uri, mime: 'application/pdf' }).catch(function () {});
      }
      VS.log('bill', 'Bill PDF ' + (share ? 'Shared' : 'Downloaded') + ' - ' + b.consumerNo); VS.save();
    } catch (e) { toast(e.message, 3500); }
    render(true);
  };

  /* ---------- DOCUMENTS VAULT ---------- */
  screens.docs = function () {
    var withDocs = S().apps.filter(function (a) { return (a.docs && (a.docs.agreement || a.docs.formx || a.docs.single)) || a.receipt; });
    var total = 0; withDocs.forEach(function (a) { ['agreement', 'formx', 'single'].forEach(function (s) { if (a.docs[s]) total += a.docs[s].size || 0; }); });
    var body = '<div class="card row between"><div class="row"><div class="ico">' + icon('shield', 18) + '</div><div><b>' + withDocs.length + ' ' + t('Folders') + '</b><div class="tiny muted">' + D.fmtSize(total) + ' \u2022 ' + t('Stored Only On This Device') + '</div></div></div></div>' +
      (S().settings.autoDelete ? '<div class="warn">' + icon('info', 16) + '<div>' + t('PDFs Are Deleted Permanently When An Application Is Approved.') + '</div></div>' : '');
    body += withDocs.length ? withDocs.map(function (a) {
      return '<div class="card"><div class="row between" onclick="UI.go(\'detail\',{id:\'' + a.id + '\'})" style="cursor:pointer"><div class="row">' + icon('folder', 20, ' style="stroke:var(--acc)"') + '<div><b class="mono">' + a.id + '</b><div class="tiny muted ell">' + esc(titleCase(a.newName) || '') + ' \u2022 ' + (VS.docMode(a) === 'spell' ? t('Spelling Correction - 1 PDF') : t('Normal - Agreement + Form X')) + '</div></div></div>' + chip(a.status) + '</div>' +
        VS.docSlots(a).map(function (s) {
          var d = a.docs[s]; if (!d) return '<div class="list-item"><div class="ico">' + icon('file', 16) + '</div><div class="grow"><div class="small muted">' + slotLabel(s) + ' - ' + t('Not Saved') + '</div></div></div>';
          return '<div class="list-item"><div class="ico">' + icon('file', 16) + '</div><div class="grow"><div class="small ell">' + esc(d.name) + '</div><div class="tiny muted">' + D.fmtSize(d.size) + (d.origSize && d.origSize !== d.size ? ' (' + t('From') + ' ' + D.fmtSize(d.origSize) + ')' : '') + '</div></div>' +
            '<button class="btn ghost sm" onclick="UI.preview(\'' + a.id + '\',\'' + s + '\',null,\'' + esc(d.name) + '\')">' + icon('eye', 14) + '</button><button class="btn ghost sm" onclick="UI.shareDoc(\'' + a.id + '\',\'' + s + '\')">' + icon('share', 14) + '</button></div>';
        }).join('') +
        (a.receipt ? '<div class="list-item"><div class="ico">' + icon('rupee', 16) + '</div><div class="grow"><div class="small ell">' + esc(a.receipt.imgName || 'Receipt') + ' + PDF</div><div class="tiny muted">' + t('Payment Receipt') + '</div></div><button class="btn ghost sm" onclick="UI.viewReceiptImg(\'' + a.id + '\')">' + icon('image', 14) + '</button><button class="btn ghost sm" onclick="UI.shareReceipt(\'' + a.id + '\')">' + icon('share', 14) + '</button></div>' : '') +
        '<button class="btn danger sm" style="width:100%;margin-top:6px" onclick="UI.delDocs(\'' + a.id + '\')">' + icon('trash', 14) + t('Delete PDFs') + '</button></div>';
    }).join('') : '<div class="card empty">' + icon('folder', 32) + '<div>' + t('No Saved Documents Yet') + '</div></div>';
    return page(hdrMain(t('Documents'), t('Vault By Application ID')), body, true);
  };
  UI.shareDoc = async function (id, slot) {
    try { var d = await Native.call('readDoc', { id: id, slot: slot }); var shr = await Native.call('share', { files: [{ name: d.name, b64: d.b64, mime: 'application/pdf' }], text: d.name }); if (shr && shr.note) toast(shr.note, 4500); } catch (e) { toast(e.message); }
  };
  UI.delDocs = async function (id) {
    if (!(await confirmBox(t('Delete PDFs?'), t('Saved PDFs For This Application Will Be Deleted. Auto Re-Upload Will Not Be Possible.'), t('Delete'), true))) return;
    await Native.call('deleteDocs', { id: id }); var a = VS.findApp(id); a.docs = {}; VS.log('deleted', 'Documents Deleted - ' + id, id); VS.changed(); render(true);
  };

  /* ---------- NOTIFICATIONS ---------- */
  screens.notifs = function () {
    UI.unread = 0; S().lastSeen = Date.now(); VS.save();
    var act = S().activity;
    var body = act.length ? '<div class="card" style="padding:4px 12px">' + act.slice(0, 100).map(actRow).join('') + '</div>' : '<div class="card empty">' + icon('bell', 30) + '<div>' + t('No Notifications Yet') + '</div></div>';
    return page(hdrBack(t('Notifications')), body, false);
  };

  /* ---------- SETTINGS ---------- */
  function seg(key, opts) {
    var v = S().settings[key];
    return '<div class="seg">' + opts.map(function (o) { return '<button class="' + (String(v) === String(o[0]) ? 'on' : '') + '" onclick="UI.set(\'' + key + '\',' + esc(JSON.stringify(o[0])) + ')">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function tog(key, label, sub) {
    var v = S().settings[key];
    return '<div class="setrow" onclick="UI.set(\'' + key + '\',' + (!v) + ')" style="cursor:pointer"><div class="lbl"><b>' + t(label) + '</b>' + (sub ? '<span>' + t(sub) + '</span>' : '') + '</div><div class="tog ' + (v ? 'on' : '') + '"></div></div>';
  }
  UI.set = async function (key, val) {
    var s = S().settings;
    if (key === 'lock' && val) return UI.setPin();
    if (key === 'bio' && val) { try { var r = await Native.call('biometric', { title: 'VidyutSewa', check: true }); if (!r || !r.ok) return toast(t('Fingerprint Not Available')); } catch (e) { return toast(e.message); } }
    if (key === 'lock' && !val) { s.pinHash = ''; s.bio = false; }
    s[key] = val;
    if (key === 'theme' || key === 'lang' || key === 'themeStyle') applyTheme();
    if (key === 'notify' || key === 'interval' || key === 'reminder') VS.schedule();
    VS.changed(); render(true);
  };
  UI.setInput = function (key, el, num) { S().settings[key] = num ? Math.max(0, parseInt(el.value, 10) || 0) : el.value; VS.changed(); };
  UI.setPin = function () {
    var w = sheet('<h3>' + t('Set 4-Digit PIN') + '</h3><input class="inp mono" id="pin1" type="password" inputmode="numeric" maxlength="4" placeholder="\u2022\u2022\u2022\u2022"><input class="inp mono" id="pin2" type="password" inputmode="numeric" maxlength="4" placeholder="' + t('Repeat PIN') + '"><button class="btn pri" id="pinok">' + t('Save PIN') + '</button>');
    w.querySelector('#pinok').onclick = async function () {
      var a = w.querySelector('#pin1').value, b = w.querySelector('#pin2').value;
      if (!/^\d{4}$/.test(a)) return toast(t('PIN Must Be 4 Digits')); if (a !== b) return toast(t('PINs Do Not Match'));
      S().settings.pinHash = await VS.sha(a); S().settings.lock = true; VS.changed(); w.remove(); render(true); toast(t('App Lock On'));
    };
  };
  UI.nextCustomer = async function () {
    if (!(await confirmBox(t('Next Customer'), t('Clears The Official Site Login, Unsaved Form, Recent Bill Numbers And Cache So The Next Customer Sees Nothing Of The Previous One. Saved Applications Stay.'), t('Clear Now')))) return;
    UI.draft = null; UI.old = null; UI.bill = null; UI.billCno = ''; S().bills = [];
    await Native.call('deleteDocs', { id: 'draft' }).catch(function () {});
    await Native.call('clearWebSession').catch(function () {});
    VS.log('wipe', 'Ready For Next Customer'); VS.changed(); toast(t('Ready For Next Customer'));
  };
  UI.exportBackup = async function () {
    try {
      toast(t('Preparing Backup') + '\u2026');
      var text = await VS.exportBackup(), d = new Date();
      var name = 'VidyutSewa_Backup_' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.vsbackup';
      var b64 = btoa(unescape(encodeURIComponent(text)));
      var r = await Native.call('saveDownload', { name: name, b64: b64, mime: 'application/octet-stream' });
      toast(t('Backup Saved') + ': ' + ((r && r.where) || name), 4000);
    } catch (e) { toast(e.message); }
  };
  UI.importBackup = async function () {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '*/*';
    inp.onchange = async function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      try {
        var text = await f.text();
        if (!(await confirmBox(t('Restore Backup?'), t('Current Data On This Device Will Be Replaced By The Backup.'), t('Restore')))) return;
        var n = await VS.importBackup(text); applyTheme(); VS.schedule(); render(); toast(n + ' ' + t('Applications Restored'));
      } catch (e) { toast(e.message, 3500); }
    };
    inp.click();
  };
  UI.clearCache = async function () { await Native.call('clearCache').catch(function () {}); toast(t('Cache Cleared')); UI.loadStorage(); };
  UI.loadStorage = async function () {
    try { var s = await Native.call('storageInfo'); var e = $('#stor'); if (e && s) e.innerHTML = t('Documents') + ': <b>' + D.fmtSize(s.docs || 0) + '</b> \u2022 ' + t('Cache') + ': <b>' + D.fmtSize(s.cache || 0) + '</b>'; } catch (x) {}
  };
  UI.checkUpdate = async function () {
    var b = $('#updbtn'); if (b) b.innerHTML = '<span class="spin"></span>';
    try {
      var r = await Native.call('http', { url: REPO_API, headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'VidyutSewa' } });
      var j = JSON.parse(r.body || '{}');
      if (!j.tag_name) throw new Error(t('No Release Found'));
      if (P.versionNewer(j.tag_name, VERSION)) {
        if (await confirmBox(t('Update Available') + ': ' + esc(j.tag_name), t('A New Version Is Available On GitHub. Open The Download Page?'), t('Open'))) UI.ext(j.html_url || REPO + '/releases/latest');
      } else toast(t('You Have The Latest Version') + ' (' + VERSION + ')');
    } catch (e) { toast(t('Could Not Check For Updates') + ': ' + e.message); }
    if (b) b.innerHTML = icon('refresh', 15) + t('Check For Updates');
  };
  screens.settings = function () {
    var s = S().settings, andr = Native.platform === 'android', ts = themeId(s.themeStyle);
    var body =
      '<div class="sethead">' + icon('moon', 15) + t('Appearance') + '</div><div class="card">' +
      '<div class="small muted" style="margin-bottom:6px">' + t('Theme') + '</div><div class="themes">' + THEMES.map(function (th) {
        return '<button class="themecard ' + (ts === th[0] ? 'on' : '') + '" style="background:' + th[2][0] + '" onclick="UI.set(\'themeStyle\',\'' + th[0] + '\')"><span class="sw"><i style="background:' + th[2][1] + '"></i><i style="background:' + th[2][2] + '"></i><i style="background:linear-gradient(90deg,' + th[2][1] + ',' + th[2][2] + ')"></i></span><span>' + th[1] + (th[0] === 'royal' ? ' \u2022 ' + t('Default') : '') + '</span></button>';
      }).join('') + '</div>' +
      '<div class="small muted" style="margin:10px 0 6px">' + t('Mode') + '</div>' + seg('theme', [['dark', t('Dark')], ['light', t('Light')], ['system', t('System')]]) +
      '<div class="small muted" style="margin:10px 0 6px">' + t('Language') + '</div>' + seg('lang', [['en', 'English'], ['hi', '\u0939\u093F\u0902\u0926\u0940'], ['mr', '\u092E\u0930\u093E\u0920\u0940']]) + '</div>' +
      '<div class="sethead">' + icon('store', 15) + t('App Mode') + '</div><div class="card">' + seg('mode', [['shop', t('Shop Mode')], ['personal', t('Personal Mode')]]) +
      (s.mode === 'shop' ? '<div class="field" style="margin-top:10px"><label>' + t('Shop Name') + '</label><input class="inp" value="' + esc(s.shopName) + '" onchange="UI.setInput(\'shopName\',this)"></div>' +
        '<div class="field" style="margin-top:8px"><label>' + t('Default Service Fee (\u20B9)') + '</label><input class="inp" inputmode="numeric" value="' + esc(s.fee) + '" onchange="UI.setInput(\'fee\',this,true)"></div>' : '') + '</div>' +
      '<div class="sethead">' + icon('bell', 15) + t('Notifications') + '</div><div class="card" style="padding:2px 12px">' + tog('notify', 'Status Notifications', 'Background Check Of Pending Applications') +
      '<div class="setrow"><div class="lbl"><b>' + t('Check Every') + '</b></div><div style="width:190px">' + seg('interval', [[15, '15 ' + t('Min')], [30, '30 ' + t('Min')], [60, '60 ' + t('Min')]]) + '</div></div>' +
      tog('reminder', '3-Day Upload Reminder', 'Alert Before Document Deadline Ends') + tog('sound', 'Sound') +
      '<div class="setrow"><button class="btn ghost sm" onclick="Native.call(\'notify\',{title:\'Application Approved - 12345678\',body:\'' + t('Test Notification') + '\'})">' + icon('bell', 14) + t('Test Notification') + '</button></div></div>' +
      '<div class="sethead">' + icon('file', 15) + t('Documents') + '</div><div class="card" style="padding:2px 12px"><div class="setrow"><div class="lbl"><b>' + t('File Size Rule') + '</b><span>' + t('Up To 1 MB: Kept As It Is. Over 1 MB: Gently Compressed To Under 1 MB.') + '</span></div></div>' +
      tog('autoReupload', 'Auto Re-Upload', 'Upload Saved PDFs Again If Rejected Or 0 Documents') + tog('autoDelete', 'Auto-Delete On Approval', 'Delete PDFs Permanently When Approved') + '</div>' +
      '<div class="sethead">' + icon('lock', 15) + t('Security') + '</div><div class="card" style="padding:2px 12px">' + tog('lock', 'App Lock (PIN)', 'Optional. Off By Default') +
      (andr && s.lock ? tog('bio', 'Fingerprint Unlock') : '') +
      (s.mode === 'shop' ? '<div class="setrow"><div class="lbl"><b>' + t('Next Customer') + '</b><span>' + t('Clear Login, Form And Recent Numbers') + '</span></div><button class="btn ghost sm" onclick="UI.nextCustomer()">' + icon('user2', 14) + t('Clear') + '</button></div>' : '') + '</div>' +
      '<div class="sethead">' + icon('msg', 15) + t('WhatsApp Message Template') + '</div><div class="card"><textarea class="inp" id="watpl" onchange="UI.setInput(\'waTemplate\',this)">' + esc(s.waTemplate) + '</textarea>' +
      '<div class="row between" style="margin-top:6px"><span class="tiny muted">{Name} {ID} {Shop Name}</span><button class="btn ghost sm" onclick="UI.set(\'waTemplate\',VS.DEFAULT_TEMPLATE)">' + t('Reset') + '</button></div></div>' +
      '<div class="sethead">' + icon('db', 15) + t('Backup & Restore') + '</div><div class="card"><div class="btns2"><button class="btn ghost sm" onclick="UI.exportBackup()">' + icon('download', 14) + t('Export Backup') + '</button><button class="btn ghost sm" onclick="UI.importBackup()">' + icon('upload', 14) + t('Import Backup') + '</button></div><div class="tiny muted" style="margin-top:6px">' + t('One File With All Applications And PDFs. Keep It Safe.') + '</div></div>' +
      '<div class="sethead">' + icon('folder', 15) + t('Storage') + '</div><div class="card row between"><div class="small" id="stor">\u2026</div><button class="btn ghost sm" onclick="UI.clearCache()">' + icon('trash', 14) + t('Clear Cache') + '</button></div>' +
      '<div class="sethead">' + icon('info', 15) + t('About') + '</div><div class="card"><div class="row"><div class="appic"></div><div><b>VidyutSewa By Yuvraj</b><div class="tiny muted">' + t('Version') + ' ' + VERSION + ' \u2022 ' + t('Electricity Name Change & Tracker') + '</div></div></div>' +
      '<div class="tiny muted" style="margin-top:8px;line-height:1.5">' + t(DISCLAIMER) + '</div>' +
      '<div class="tiny muted" style="margin-top:6px;line-height:1.5">' + t('Privacy: No Server, No Analytics, No Data Collection. Everything Stays On This Device.') + '</div>' +
      '<div class="btns2" style="margin-top:8px"><button class="btn ghost sm" id="updbtn" onclick="UI.checkUpdate()">' + icon('refresh', 15) + t('Check For Updates') + '</button><button class="btn ghost sm" onclick="UI.ext(\'' + REPO + '\')">' + icon('ext', 15) + 'GitHub</button></div></div>';
    setTimeout(UI.loadStorage, 30);
    return page(hdrBack(t('Settings')), body, false);
  };

  /* ---------- BOOT ---------- */
  async function boot() {
    root = document.getElementById('root');
    await VS.load();
    applyTheme();
    var s = S().settings;
    UI.unread = S().activity.filter(function (a) { return a.t > (S().lastSeen || 0); }).length;
    if (s.lock && s.pinHash) UI.locked = true;
    if (!s.onboarded) UI.route = 'mode';
    var pend = sessionStorage.getItem('vs-open');
    render();
    setTimeout(function () {
      var sp = document.getElementById('splash'); if (sp) { sp.style.opacity = '0'; setTimeout(function () { sp.remove(); }, 450); }
      if (UI.locked && s.bio && Native.platform === 'android') UI.bio();
    }, 1600);
    VS.schedule();
    VS.onChange(function () { UI.unread = S().activity.filter(function (a) { return a.t > (S().lastSeen || 0); }).length; });
    if (Native.platform !== 'android' && s.onboarded) setTimeout(function () { if (S().apps.some(function (a) { return a.status !== 'approved'; }) && Date.now() - (S().lastSync || 0) > 10 * 60000) VS.syncAll().then(function () { render(true); }); }, 4000);
  }
  Native.on('back', function () { UI.back(); });
  Native.on('dataChanged', async function () { await VS.load(); if (!document.querySelector('.sheetwrap') && ['home', 'apps', 'detail', 'docs', 'notifs'].indexOf(UI.route) >= 0) render(true); });
  Native.on('resume', function () {
    var s = S().settings; if (s.lock && s.pinHash && UI.lockOnResume) { UI.locked = true; render(); }
    VS.load().then(function () { if (!UI.locked && ['home', 'apps', 'detail'].indexOf(UI.route) >= 0) render(true); });
  });
  Native.on('pause', function () { UI.lockOnResume = true; });
  Native.on('openApp', function (d) { if (d && d.id && VS.findApp(d.id) && !UI.locked) UI.go('detail', { id: d.id }); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
