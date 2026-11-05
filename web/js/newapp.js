/* VidyutSewa By Yuvraj v1.1.0 - NATIVE "New Application" (Change Of Name).
 * The official wss.mahadiscom.in pages run invisibly in a hidden session (see vsdrv.js); this file mirrors each step in native screens.
 * The person types captcha, OTPs and Aadhaar here; the app only hands them to the official page. Submit and payment happen only on a tap.
 * Nothing is stored except the (optional) login name + password in the device's secure storage, and the saved application itself. */
(function () {
  'use strict';
  var H = UI._h, t = H.t, esc = H.esc, page = H.page, hdrBack = H.hdrBack, P = window.VSParse, D = window.VSDocs, S = H.S;
  var LOGIN_URL = H.consts.LOGIN_URL, LANG_URL = 'https://wss.mahadiscom.in/wss/wss?uiActionName=getHome&Lang=English';
  var NA = null, NAUI = window.NAUI = {};
  var root = function () { return document.getElementById('root'); };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function toast(m, ms) { UI.toast(m, ms); }
  function ic(n, s, x) { return window.icon(n, s, x); }

  /* ---------- the hidden official session ---------- */
  var Drv = {
    seq: function () { return Native.call('drvSeq').then(function (r) { return { seq: (r && r.seq) | 0, start: (r && r.start) | 0 }; }); },
    load: function (url) { return Native.call('drvLoad', { url: url }); },
    ev: function (expr, ms) { return Native.call('drvEval', { script: expr, timeout: ms || 20000 }); },
    d: function (fn) { var a = [].slice.call(arguments, 1).map(function (x) { return JSON.stringify(x === undefined ? null : x); }).join(','); return Drv.ev('__vsd.' + fn + '(' + a + ')'); },
    // a page that starts loading after the action counts as a navigation; if nothing starts within `quick` ms it was an in-page (ajax) action
    waitNav: function (s, ms) { return Native.call('drvWaitNav', { seq: s.seq, start: s.start, ms: ms || 8000, quick: 1800 }); },
    msgs: function () { return Native.call('drvMsgs').then(function (r) { return (r && r.msgs) || []; }).catch(function () { return []; }); },
    show: function (title, copy) { return Native.call('drvShow', { title: title, copy: copy || [] }); },
    hide: function () { return Native.call('drvHide').catch(function () {}); },
    reset: function () { return Native.call('drvReset').catch(function () {}); }
  };
  NAUI.Drv = Drv;
  // run an action that may navigate; returns {r, navigated, msgs}
  async function act(label, fn, wait) {
    await Drv.msgs();
    var s = await Drv.seq(), r, err = '';
    try { r = await fn(); } catch (e) { err = e.message || String(e); }
    var nav = await Drv.waitNav(s, wait || 4500).catch(function () { return {}; });
    await sleep(nav && nav.navigated ? 350 : 700);
    var m = await Drv.msgs(); var pm = await Drv.ev('__vsd.drain()').catch(function () { return null; });
    var all = m.concat((pm && pm.msgs) || []).map(function (x) { return x.t; }).filter(Boolean);
    diag('act', label, !err && !(r && r.ok === false), (err || (r && r.err) || '') + (r && r.text ? 'clicked "' + r.text + '"' + (r.id ? ' #' + r.id : '') : '') + (all.length ? ' | msgs: ' + all.join(' / ') : ''));
    return { r: r, err: err, navigated: !!(nav && nav.navigated), msgs: all };
  }
  function diag(kind, what, ok, detail) {
    if (!NA) return;
    NA.diag.push({ at: Date.now(), step: NA.step, kind: kind, what: what, ok: ok !== false, detail: String(detail || '').slice(0, 300) });
    if (NA.diag.length > 300) NA.diag.shift();
  }
  async function fillSite(label, spec, value, required) {
    var r = await Drv.d('fill', spec, value).catch(function (e) { return { ok: false, err: e.message }; });
    diag('field', label, r && r.ok, r && r.ok ? (r.matched ? (r.matched.label || r.matched.id) : '') : ((r && r.err) || 'failed') + ' tried: ' + (spec.any || []).join(','));
    if (r && !r.ok && required) NA.failed.push(label);
    return r;
  }
  function deltaLines(before, after) {
    var b = {}; String(before || '').split(/\n|\s{3,}/).forEach(function (x) { b[x.trim()] = 1; });
    return String(after || '').split(/\n|\s{3,}/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !b[x]; });
  }
  async function snap() { return Drv.d('snap').catch(function () { return null; }); }

  /* ---------- field specs (label based: tolerant of the real ids) ---------- */
  var NOT_BOX = ['checkbox', 'radio', 'file', 'button', 'submit'];
  var SP = {
    user: { any: ['loginId', 'user name', 'username', 'login name', 'user id', 'login id'], tag: 'input', notType: ['password', 'checkbox', 'radio', 'button', 'submit'], editable: true },
    pass: { any: ['password'], type: 'password' },
    captcha: { any: ['txtInput', 'captcha', 'enter the code', 'security code', 'verification code'], tag: 'input', notType: ['password', 'checkbox', 'radio', 'button', 'submit'], editable: true },
    loginBtn: { any: ['loginButton', 'generate otp', 'login', 'log in', 'sign in'], not: ['clear', 'loginbuttonotp', 'reset', 'cancel', 'register', 'forgot', 'new user'] },   // on the real page the first button is labelled "Generate OTP" (id loginButton)
    loginBtnOtp: { any: ['loginButtonOTP', 'login', 'verify', 'submit', 'validate'], not: ['clear', 'reset', 'cancel', 'register', 'forgot', 'new user'], last: true },
    loginOtp: { any: ['txtOTP', 'otp', 'one time'], tag: 'input', notType: NOT_BOX, editable: true },
    title: { tag: 'select', any: ['title', 'first name', 'salutation'], optHas: ['m/s', 'mrs', 'smt', 'mr'], not: ['reason', 'category'] },
    first: { tag: 'input', any: ['first name', 'firstname', 'fname', 'first'], notType: NOT_BOX, editable: true, not: ['old'] },
    middle: { tag: 'input', any: ['middle name', 'middlename', 'mname', 'middle'], notType: NOT_BOX, editable: true },
    last: { tag: 'input', any: ['last name', 'lastname', 'surname', 'lname'], notType: NOT_BOX, editable: true },
    full: { tag: 'input', any: ['consumer full name', 'full name', 'fullname'], notType: NOT_BOX },
    email: { tag: 'input', any: ['email id', 'emailid', 'email', 'e-mail'], notType: NOT_BOX, editable: true, not: ['otp', 'old'] },
    mobile: { tag: 'input', any: ['mobile number', 'mobile no', 'mobile', 'cell'], notType: NOT_BOX, editable: true, not: ['otp', 'old', 'aadhaar', 'aadhar'] },
    reason: { tag: 'select', any: ['select a reason', 'reason', 'purpose'], optHas: ['ownership', 'spelling', 'death', 'partition', 'correction', 'transfer'] },
    aadConsent: { type: 'checkbox', any: ['aadhaar', 'aadhar', 'uidai', 'consent'] },
    aadNo: { tag: 'input', any: ['aadhaar number', 'aadhar number', 'aadhaarno', 'aadhaar no', 'aadhar no', 'uid number', 'aadhaar', 'aadhar'], notType: NOT_BOX, editable: true, not: ['otp'] },
    declare: { type: 'checkbox', any: ['agree', 'terms and conditions', 'declare', 'declaration', 'accept'], not: ['aadhaar', 'aadhar'] },
    place: { tag: 'input', any: ['place'], notType: NOT_BOX, editable: true },
    submit: { any: ['submit'], not: ['otp', 'resubmit', 'back', 'reset', 'cancel'], last: true },
    changeName: { any: ['change of name', 'name change', 'change name'] },
    addConsumer: { any: ['add consumer', 'add new consumer', 'add account', 'link consumer'] },
    myAccount: { any: ['my account', 'my accounts', 'consumer list'] },
    pay: { any: ['pay processing fee', 'pay now', 'proceed to pay', 'make payment', 'pay fee', 'pay online', 'payment'], not: ['later', 'cancel', 'history', 'receipt'] },
    viewReceipt: { any: ['view receipt', 'download receipt', 'print receipt', 'receipt'] }
  };
  function otpFieldsOf(s) {
    return (s.fields || []).filter(function (f) {
      var k = (f.label + ' ' + f.id + ' ' + f.name).toLowerCase();
      return /otp/.test(k) && !/aadhaar|aadhar|aad/.test(k) && !/captcha/.test(k) && f.type !== 'checkbox' && f.type !== 'radio' && f.tag === 'input' && !f.ro;
    });
  }

  /* ---------- state ---------- */
  function fresh() {
    return { step: 'start', mode: 'normal', busy: '', err: '', info: '', diag: [], failed: [], taps: 0,
      fee: S().settings.fee || 0, custMobile: '',
      login: { user: '', pass: '', remember: false, captcha: '', cap: '', otp: '', needOtp: false, creds: false },
      accounts: [], sel: '', old: [],
      f: { title: '', first: '', middle: '', last: '', email: '', mobile: '', reason: '', place: '', titles: [], reasons: [], req: {}, siteFull: '', agree: false },
      aad: { consent: false, hasNo: false, optional: false, no: '', otp: '', note: '', sent: false, mobile: '', msg: '', verified: false, done: false, siteHas: false },
      p3: { otp: {}, otpFields: [], sent: false, msg: '', agree: false, place: '' },
      appNo: '', slots: [], uploadDone: false, payFee: 0, wait: { until: 0, last: 0, status: '', rows: [] }, receipt: null, gen: null, savedId: '' };
  }
  var STEPS = ['login', 'accounts', 'form', 'aadhaar', 'confirm', 'docs', 'pay'];
  function stepNo() { var m = { login: 1, accounts: 2, form: 3, aadhaar: 4, confirm: 5, docs: 6, pay: 7, wait: 7, receipt: 7 }; return m[NA.step] || 0; }

  UI.newApp = function () {
    if (NA && NA.savedId === '' && NA.step !== 'start' && NA.step !== 'receipt' && NA.appNo === '' && Date.now() - (NA.at || 0) < 600000) { /* resume a flow left a moment ago */ }
    else { NA = fresh(); }
    NA.at = Date.now();
    UI.go('na');
  };
  UI.screens.na = function () { return NAUI.render(); };
  var oldBack = UI.back;
  UI.back = function () {
    var sh = document.querySelector('.sheetwrap'); if (sh) { sh.remove(); return true; }
    if (UI.route === 'na' && NA) return NAUI.back();
    return oldBack();
  };
  function rerender(keep) { readInputs(); UI.render(keep !== false); bindInputs(); }
  NAUI.rerender = rerender;
  function setStep(s, keepErr) { readInputs(); NA.step = s; if (!keepErr) { NA.err = ''; NA.info = ''; } NA.busy = ''; UI.render(false); bindInputs(); }
  function busy(msg) { NA.busy = msg; NA.err = ''; rerender(true); }
  function fail(msg) { NA.busy = ''; NA.err = msg; rerender(true); }

  // inputs carry data-k="path.to.value"; read them into the state before every re-render
  function readInputs() {
    if (!NA) return;
    Array.prototype.forEach.call(root().querySelectorAll('[data-k]'), function (e) {
      var path = e.getAttribute('data-k').split('.'), o = NA;
      for (var i = 0; i < path.length - 1; i++) o = o[path[i]];
      var k = path[path.length - 1];
      if (e.type === 'checkbox') o[k] = !!e.checked; else o[k] = e.value;
    });
    Array.prototype.forEach.call(root().querySelectorAll('[data-otp]'), function (e) { NA.p3.otp[e.getAttribute('data-otp')] = e.value; });
    Array.prototype.forEach.call(root().querySelectorAll('[data-gi]'), function (e) { if (NA.gen) NA.gen.vals[e.getAttribute('data-gi')] = e.type === 'checkbox' ? !!e.checked : e.value; });
  }
  function bindInputs() {
    var el = root();
    ['first', 'middle', 'last'].forEach(function (k) {
      var e = el.querySelector('[data-k="f.' + k + '"]'); if (!e) return;
      e.addEventListener('input', function () {
        readInputs();
        var c = P.clampName({ title: NA.f.title, first: NA.f.first, middle: NA.f.middle, last: NA.f.last }, k);
        if (c[k] !== NA.f[k]) { NA.f[k] = c[k]; e.value = c[k]; }
        nameLive();
      });
    });
    var ti = el.querySelector('[data-k="f.title"]'); if (ti) ti.addEventListener('change', function () { readInputs(); ['first', 'middle', 'last'].forEach(function (k) { var c = P.clampName({ title: NA.f.title, first: NA.f.first, middle: NA.f.middle, last: NA.f.last }, k); NA.f[k] = c[k]; var e = el.querySelector('[data-k="f.' + k + '"]'); if (e) e.value = c[k]; }); nameLive(); });
    var ad = el.querySelector('[data-k="aad.no"]'); if (ad) ad.addEventListener('input', function () { ad.value = ad.value.replace(/\D/g, '').slice(0, 12); NA.aad.no = ad.value; var b = el.querySelector('#aad-gen'); if (b) b.disabled = !(ad.value.length === 12 && NA.aad.consent); });
    ['login.captcha', 'login.otp'].forEach(function (k) { var e = el.querySelector('[data-k="' + k + '"]'); if (e) e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') NAUI.doLogin(); }); });
  }
  function fullName() { return P.composeName(NA.f.title, NA.f.first, NA.f.middle, NA.f.last); }
  function nameLive() {
    var n = fullName(), c = root().querySelector('#nm-count'), f = root().querySelector('#nm-full');
    if (c) { c.textContent = t('Name Length') + ': ' + n.length + ' / ' + P.NAME_MAX; c.className = 'chip ' + (n.length >= P.NAME_MAX ? 'c-r' : 'c-c'); }
    if (f) f.value = n;
  }

  /* ---------- screens ---------- */
  function head(title) {
    return '<header class="hdr"><button class="iconbtn" onclick="UI.back()" aria-label="' + t('Back') + '">' + ic('back', 22) + '</button><div class="t"><h1 onclick="NAUI.tap()">' + esc(title) + '</h1><div class="s">' + (stepNo() ? t('Step') + ' ' + stepNo() + ' / ' + STEPS.length : '') + '</div></div></header>';
  }
  function stepsBar() { var n = stepNo(); return '<div class="steps">' + STEPS.map(function (s, i) { return '<i class="' + (n > i ? 'on' : '') + '"></i>'; }).join('') + '</div>'; }
  function errBox() { return NA.err ? '<div class="warn" style="border-color:rgba(200,80,70,.5)">' + ic('alert', 16) + '<div>' + esc(NA.err) + '<div style="margin-top:6px"><button class="btn ghost sm" onclick="NAUI.official()">' + ic('ext', 14) + t('Open Official Page') + '</button> <button class="btn ghost sm" onclick="NAUI.diag()">' + ic('info', 14) + t('Diagnostics') + '</button></div></div></div>' : ''; }
  function infoBox() { return NA.info ? '<div class="warn" style="border-color:rgba(110,180,130,.5)">' + ic('info', 16) + '<div>' + esc(NA.info) + '</div></div>' : ''; }
  function busyBox() { return NA.busy ? '<div class="card row" style="margin-bottom:10px"><span class="spin acc"></span><div class="small">' + esc(NA.busy) + '</div></div>' : ''; }
  function privacy() { return '<div class="tiny muted" style="text-align:center">' + t('You Type Captcha, OTP And Aadhaar Here. They Go Only To The Official MSEDCL Site And Are Never Saved.') + '</div>'; }
  function fld(label, key, opts) {
    opts = opts || {};
    return '<div class="field"><label>' + esc(label) + (opts.req ? ' *' : '') + '</label><input class="inp ' + (opts.mono ? 'mono' : '') + '" data-k="' + key + '" ' + (opts.type ? 'type="' + opts.type + '" ' : '') + (opts.inputmode ? 'inputmode="' + opts.inputmode + '" ' : '') + (opts.max ? 'maxlength="' + opts.max + '" ' : '') + (opts.ph ? 'placeholder="' + esc(opts.ph) + '" ' : '') + 'autocomplete="off" autocapitalize="' + (opts.cap || 'off') + '" value="' + esc(getPath(key)) + '"></div>';
  }
  function getPath(key) { var o = NA, p = key.split('.'); for (var i = 0; i < p.length; i++) o = o ? o[p[i]] : ''; return o == null ? '' : o; }
  function tick(key, label, on) { return '<div class="check ' + (on ? 'on' : '') + '" onclick="NAUI.tickK(\'' + key + '\')"><span class="box">' + (on ? ic('check', 14) : '') + '</span><span>' + label + '</span></div>'; }
  NAUI.tickK = function (key) { readInputs(); var p = key.split('.'), o = NA; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = !o[p[p.length - 1]]; if (key === 'aad.consent') return NAUI.aadConsent(); rerender(true); };
  function fallbackLink() { return '<div style="text-align:center"><button class="btn ghost sm" onclick="NAUI.official()">' + ic('ext', 14) + t('Open Official Page') + '</button></div>'; }

  NAUI.render = function () {
    if (!NA) NA = fresh();
    var s = NA.step, body = '', title = t('New Application');
    var R = NAUI.views;
    if (R[s]) { var v = R[s](); body = v.body; title = v.title || title; }
    return page(head(title), body, false);
  };
  NAUI.views = {};
  NAUI.tap = function () { NA.taps++; clearTimeout(NAUI._tt); NAUI._tt = setTimeout(function () { NA.taps = 0; }, 2500); if (NA.taps >= 5) { NA.taps = 0; NAUI.diag(); } };

  /* ---- start: type choice ---- */
  NAUI.views.start = function () {
    var shop = S().settings.mode === 'shop';
    function opt(key, title, sub) { var on = NA.mode === key; return '<div class="card modecard ' + (on ? 'sel' : '') + '" style="margin:0" onclick="NAUI.setMode(\'' + key + '\')"><div class="grow"><b>' + title + '</b><div class="tiny muted">' + sub + '</div></div>' + (on ? ic('check', 20, ' style="stroke:var(--acc)"') : '') + '</div>'; }
    var body = '<div class="card glow"><b>' + t('Apply For Change Of Name') + '</b><div class="small muted" style="margin-top:4px">' + t('The Whole Application Is Done Inside This App. The Official MSEDCL Site Runs Quietly Behind It.') + '</div></div>' +
      '<div class="field"><label>' + t('Application Type') + '</label><div style="display:flex;flex-direction:column;gap:8px">' +
      opt('normal', t('Normal - Agreement + Form X'), t('Agreement And Form X Are Both Mandatory.')) +
      opt('spell', t('Spelling Correction - 1 PDF'), t('Only One PDF Is Uploaded When The Reason Is A Spelling Correction.')) + '</div></div>' +
      fld(t('Customer Mobile (For WhatsApp, Optional)'), 'custMobile', { mono: 1, inputmode: 'tel', max: 10 }) +
      (shop ? fld(t('Service Fee (\u20B9)'), 'fee', { inputmode: 'numeric' }) : '') +
      privacy() +
      '<button class="btn pri" onclick="NAUI.begin()">' + t('Start') + ' ' + ic('right', 18) + '</button>' +
      '<div class="tiny muted" style="text-align:center;cursor:pointer" onclick="UI.go(\'newapp\')">' + t('Use Manual Mode (Official Page)') + '</div>';
    return { body: body, title: t('New Application') };
  };
  NAUI.setMode = function (m) { readInputs(); NA.mode = m; rerender(true); };
  NAUI.begin = function () { readInputs(); NA.custMobile = String(NA.custMobile || '').replace(/\D/g, '').slice(0, 10); NA.fee = parseInt(NA.fee, 10) || 0; NAUI.toLogin(); };

  /* ---- login ---- */
  NAUI.toLogin = async function () {
    NA.step = 'login'; NA.login.captcha = ''; NA.login.cap = ''; NA.login.needOtp = false; NA.login.otp = '';
    busy(t('Opening The Official Login Page...'));
    try {
      var c = await Native.call('credGet').catch(function () { return null; });
      if (c && c.user) { NA.login.user = c.user; NA.login.pass = c.pass || ''; NA.login.remember = true; NA.login.creds = true; }
      await Drv.reset();
      await Drv.load(LANG_URL).catch(function () {});   // the site opens in Marathi on a fresh session: ask for English first
      await Drv.load(LOGIN_URL);
      await loadCaptcha();
      NA.busy = ''; rerender(false);
    } catch (e) { fail(t('Could Not Open The Official Login Page') + ': ' + (e.message || e)); }
  };
  async function loadCaptcha() {
    for (var i = 0; i < 10; i++) {
      var c = await Drv.d('captcha').catch(function () { return null; });
      if (c && c.ok) { NA.login.cap = c.dataUrl; diag('captcha', 'read', true, c.w + 'x' + c.h); return true; }
      if (c && !c.wait && i > 3) { diag('captcha', 'read', false, (c && c.err) || ''); break; }
      await sleep(600);
    }
    NA.login.cap = ''; return false;
  }
  NAUI.newCaptcha = async function () {
    readInputs(); busy(t('Getting A New Captcha...'));
    var old = NA.login.cap;
    await Drv.d('refreshCaptcha');
    for (var k = 0; k < 6; k++) { await sleep(700); var c = await Drv.d('captcha').catch(function () { return null; }); if (c && c.ok && c.dataUrl !== old) { NA.login.cap = c.dataUrl; break; } }   // the site redraws the captcha itself
    if (NA.login.cap === old) await loadCaptcha();
    NA.login.captcha = ''; NA.busy = ''; rerender(true);
  };
  NAUI.views.login = function () {
    var L = NA.login, cap = L.cap ? '<img src="' + L.cap + '" style="height:54px;border-radius:8px;background:#fff;image-rendering:auto" alt="captcha">' : '<div class="small muted">' + t('Captcha Not Loaded') + '</div>';
    var body = stepsBar() + '<div class="card"><div class="row"><span class="acc">' + ic('lock', 18) + '</span><div class="small"><b>' + t('Login To MSEDCL (WSS)') + '</b><div class="muted tiny">' + t('Same User Name And Password As The Official Website.') + '</div></div></div></div>' + errBox() + infoBox() + busyBox();
    if (L.needOtp) {
      body += '<div class="card"><div class="small">' + esc(L.otpMsg || t('The Official Site Sent An OTP To The Registered Mobile.')) + '</div></div>' + fld(t('OTP'), 'login.otp', { mono: 1, inputmode: 'numeric', max: 8 }) +
        '<button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.doLogin()">' + t('Verify OTP And Login') + '</button>';
    } else {
      body += fld(t('User Name'), 'login.user', { cap: 'off' }) + fld(t('Password'), 'login.pass', { type: 'password' }) +
        '<div class="field"><label>' + t('Captcha') + '</label><div class="row">' + cap + '<button class="btn ghost sm" onclick="NAUI.newCaptcha()">' + ic('refresh', 15) + t('New') + '</button></div></div>' +
        fld(t('Type The Captcha'), 'login.captcha', { max: 8, cap: 'characters' }) +
        tick('login.remember', t('Remember On This Phone (Secure Storage)'), L.remember) +
        '<div class="tiny muted">' + t('Saved Only On This Device, Locked By Android Security. Never Sent Anywhere Except The Official Site.') + '</div>' +
        '<button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.doLogin()">' + t('Login') + '</button>' +
        (L.creds ? '<button class="btn ghost sm" onclick="NAUI.forgetCreds()">' + ic('trash', 14) + t('Forget Saved Login') + '</button>' : '');
    }
    return { body: body + privacy(), title: t('Login') };
  };
  NAUI.forgetCreds = async function () { await Native.call('credClear').catch(function () {}); NA.login.creds = false; NA.login.user = ''; NA.login.pass = ''; NA.login.remember = false; rerender(true); toast(t('Saved Login Removed')); };
  async function classify() {
    var s = await snap(); if (!s) return { kind: 'none' };
    var hasPass = s.fields.some(function (f) { return f.type === 'password' && f.vis; });
    var cons = await Drv.d('consumers').catch(function () { return []; });
    var otps = otpFieldsOf(s);
    var low = (s.text || '').toLowerCase();
    var kind = 'other';
    if (cons && cons.length) kind = 'accounts';
    else if (s.fields.some(function (f) { return (f.tag === 'input' && /first\s*name|firstname/i.test(f.label + f.id + f.name)); }) && s.fields.some(function (f) { return f.tag === 'select' && /reason|purpose/i.test(f.label + f.id + f.name + JSON.stringify(f.options || [])); })) kind = 'form';
    else if (s.fields.some(function (f) { return f.type === 'file'; })) kind = 'upload';
    else if (otps.length && /login|sign in/i.test(low) && !(NA.step === 'confirm')) kind = hasPass && !/enter the otp|otp/i.test(low) ? 'login' : 'loginotp';
    else if (hasPass) kind = 'login';
    else if (/logout|log out|sign out/.test(low)) kind = 'home';
    return { kind: kind, s: s, cons: cons || [] };
  }
  NAUI.classify = classify;
  function siteErrors(s, extra) {
    var out = [];
    (extra || []).forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
    ((s && s.msgs) || []).forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  NAUI.doLogin = async function () {
    readInputs(); var L = NA.login;
    if (NA.busy) return;
    if (L.needOtp) {
      if (!/^\d{4,8}$/.test(String(L.otp || '').trim())) return fail(t('Enter The OTP'));
      busy(t('Verifying OTP With The Official Site...')); NA.failed = [];
      await fillSite('Login OTP', SP.loginOtp, L.otp.trim(), true);
      var a = await act('click Login (OTP)', function () { return Drv.d('click', SP.loginBtnOtp); }, 9000);
      L.otp = ''; return afterLogin(a);
    }
    if (!L.user.trim() || !L.pass || !L.captcha.trim()) return fail(t('Enter User Name, Password And Captcha'));
    busy(t('Logging In On The Official Site...')); NA.failed = [];
    await fillSite('User Name', SP.user, L.user.trim(), true); await fillSite('Password', SP.pass, L.pass, true); await fillSite('Captcha', SP.captcha, L.captcha.trim(), true);
    if (NA.failed.length) return fail(t('Could Not Fill') + ': ' + NA.failed.join(', '));
    var a2 = await act('click Login', function () { return Drv.d('click', SP.loginBtn); }, 9000);
    L.captcha = ''; return afterLogin(a2);
  };
  async function afterLogin(a) {
    var L = NA.login, w = null;
    for (var i = 0; i < 12; i++) {
      w = await classify();
      if (w.kind === 'accounts' || w.kind === 'home' || w.kind === 'loginotp' || (w.kind === 'login' && (a.msgs.length || (w.s && w.s.msgs.length)) && i > 0)) break;
      await sleep(900);
    }
    if (!w) return fail(t('No Answer From The Official Site'));
    if (w.kind === 'loginotp') {
      L.needOtp = true; L.otpMsg = siteErrors(w.s, a.msgs).filter(function (x) { return /otp/i.test(x); })[0] || ''; NA.busy = ''; return rerender(false);
    }
    if (w.kind === 'login' || w.kind === 'none') {
      var errs = siteErrors(w.s, a.msgs).filter(function (x) { return !/^login$/i.test(x); });
      L.needOtp = false; await loadCaptcha(); NA.busy = '';
      return fail((errs[0] || t('Login Did Not Go Through. Check The Details And Captcha.')));
    }
    // logged in
    if (L.remember) await Native.call('credSet', { user: L.user.trim(), pass: L.pass }).then(function () { L.creds = true; }).catch(function () { toast(t('Could Not Save The Login On This Phone')); });
    else await Native.call('credClear').catch(function () {});
    L.pass = ''; L.needOtp = false;
    NAUI.toAccounts();
  }

  /* ---- accounts (consumer list) ---- */
  async function ensureAccounts() {
    var w = await classify();
    if (w.kind === 'accounts') return w;
    var b = await Drv.d('hasButton', SP.myAccount);
    if (b && b.ok) { await act('open My Account', function () { return Drv.d('click', SP.myAccount); }, 7000); w = await classify(); }
    return w;
  }
  NAUI.toAccounts = async function () {
    NA.step = 'accounts'; busy(t('Reading Your Consumer List...'));
    try {
      var w = await ensureAccounts();
      if (w.kind === 'login') { NA.err = t('Session Expired. Please Login Again.'); return NAUI.toLogin(); }
      NA.accounts = w.cons.map(function (c) { return { cno: c.cno, text: c.text, cells: c.cells }; });
      diag('page', 'accounts', NA.accounts.length > 0, NA.accounts.length + ' consumers; page=' + w.kind);
      NA.busy = '';
      if (!NA.accounts.length) { NA.err = t('No Consumer List Found On This Page.') + ' ' + t('Add A Consumer Or Open The Official Page.'); }
      rerender(false);
    } catch (e) { fail(e.message || String(e)); }
  };
  NAUI.views.accounts = function () {
    var A = NA.accounts, body = stepsBar() + '<div class="sec">' + t('Select Consumer') + '</div>' + errBox() + busyBox();
    body += A.length ? A.map(function (c) {
      var on = NA.sel === c.cno, cells = c.cells.filter(function (x) { return x !== c.cno; }).slice(0, 3);
      return '<div class="card modecard ' + (on ? 'sel' : '') + '" style="margin:0" onclick="NAUI.pickCons(\'' + c.cno + '\')"><div class="grow"><b class="mono">' + esc(c.cno) + '</b><div class="tiny muted">' + esc(cells.join(' \u2022 ')) + '</div></div>' + (on ? ic('check', 20, ' style="stroke:var(--acc)"') : '') + '</div>';
    }).join('') : (NA.busy ? '' : '<div class="card empty">' + ic('user', 30) + '<div>' + t('No Consumers Found') + '</div></div>');
    body += '<button class="btn pri" ' + (NA.sel && !NA.busy ? '' : 'disabled') + ' onclick="NAUI.openForm()">' + t('Continue') + ' ' + ic('right', 18) + '</button>' +
      '<button class="btn out" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.addConsumer()">' + ic('plus', 17) + t('Add Consumer') + '</button>' + fallbackLink();
    return { body: body, title: t('Select Consumer') };
  };
  NAUI.pickCons = function (cno) { NA.sel = cno; rerender(true); };
  NAUI.addConsumer = async function () {
    busy(t('Opening Add Consumer...'));
    var a = await act('click Add Consumer', function () { return Drv.d('click', SP.addConsumer); }, 7000);
    if (a.r && a.r.ok === false) return fail(t('Could Not Find The Add Consumer Button'));
    NA.back = 'accounts'; await NAUI.toGeneric(t('Add Consumer'));
  };
  NAUI.openForm = async function () {
    if (!NA.sel) return;
    busy(t('Opening Change Of Name...'));
    var s = await Drv.d('selectConsumer', NA.sel);
    diag('field', 'select consumer', s && s.ok, JSON.stringify(s || {}));
    if (!s || !s.ok) return fail(t('Could Not Select The Consumer On The Official Page'));
    var a = await act('click Change Of Name', function () { return Drv.d('click', SP.changeName); }, 10000);
    if (a.r && a.r.ok === false) return fail(t('Could Not Find The Change Of Name Button'));
    var w = null;
    for (var i = 0; i < 8; i++) { w = await classify(); if (w.kind === 'form') break; await sleep(800); }
    if (!w || w.kind !== 'form') {
      var errs = siteErrors(w && w.s, a.msgs);
      if (errs.length) return fail(errs[0]);
      diag('page', 'expected change-of-name form', false, w ? w.kind : 'none');
      NA.back = 'accounts'; return NAUI.toGeneric(t('Change Of Name'), t('The App Could Not Match This Page. You Can Fill It Here Or Open The Official Page.'));
    }
    await readFormPage(w.s);
    NA.busy = ''; setStep('form');
  };
  async function readFormPage(s) {
    var tt = await Drv.d('options', SP.title).catch(function () { return null; });
    var rr = await Drv.d('options', SP.reason).catch(function () { return null; });
    var okOpt = function (o) { return o && o.t && !/^[-\s]*select|^choose|^\s*$/i.test(o.t); };
    NA.f.titles = tt && tt.ok ? tt.options.filter(okOpt).map(function (o) { return o.t; }) : [];
    NA.f.reasons = rr && rr.ok ? rr.options.filter(okOpt).map(function (o) { return o.t; }) : [];
    diag('page', 'title options', NA.f.titles.length > 0, NA.f.titles.join(', '));
    diag('page', 'reason options', NA.f.reasons.length > 0, NA.f.reasons.length + ' reasons');
    // required marks come from the site's own labels (an asterisk)
    NA.f.req = {};
    (s.fields || []).forEach(function (f) {
      if (!f.vis || f.ro || !/\*/.test(f.label)) return;
      var L = f.label.toLowerCase();
      ['first', 'last', 'middle', 'email', 'mobile', 'reason', 'place'].forEach(function (k) { if (L.indexOf(k) >= 0 || (k === 'reason' && /purpose|reason/.test(L))) NA.f.req[k] = true; });
    });
    var kv = await Drv.d('kv').catch(function () { return []; });
    var want = /consumer\s*(number|no|name)|billing|sub.?category|meter|address|application date/i;
    var seen = {};
    NA.old = (kv || []).filter(function (r) { var k = r[0].toLowerCase(); if (!want.test(k) || !r[1] || seen[k] || /^(-+\s*select)/i.test(r[1])) return false; seen[k] = 1; return true; }).slice(0, 8);
    var def = NA.f.reasons.filter(function (x) { return NA.mode === 'spell' ? /spell|correct/i.test(x) : false; })[0];
    if (def && !NA.f.reason) NA.f.reason = def;
    if (!NA.f.mobile && NA.custMobile) NA.f.mobile = NA.custMobile;
  }
  NAUI.views.form = function () {
    var F = NA.f, n = fullName(), req = F.req || {};
    var titles = F.titles.length ? F.titles : [];
    var body = stepsBar() + errBox() + busyBox() +
      '<div class="row between"><div class="sec" style="margin:0">' + t('New Consumer Details') + '</div><span id="nm-count" class="chip ' + (n.length >= P.NAME_MAX ? 'c-r' : 'c-c') + '">' + t('Name Length') + ': ' + n.length + ' / ' + P.NAME_MAX + '</span></div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px">' +
      (NA.old.length ? '<div class="small muted">' + NA.old.map(function (r) { return esc(r[0].replace(/[:*\s]+$/, '')) + ': <b>' + esc(r[1]) + '</b>'; }).join(' \u2022 ') + '</div>' : '') +
      '<div class="inprow"><div class="field" style="flex:0 0 36%"><label>' + t('Title') + ' *</label><select class="inp" data-k="f.title"><option value="">' + t('Select') + '</option>' + titles.map(function (x) { return '<option ' + (F.title === x ? 'selected' : '') + ' value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" style="flex:1"><label>' + t('First Name') + ' *</label><input class="inp" data-k="f.first" autocomplete="off" autocapitalize="words" value="' + esc(F.first) + '"></div></div>' +
      '<div class="inprow"><div class="field" style="flex:1"><label>' + t('Middle Name') + '</label><input class="inp" data-k="f.middle" autocomplete="off" autocapitalize="words" value="' + esc(F.middle) + '"></div>' +
      '<div class="field" style="flex:1"><label>' + t('Last Name') + (req.last ? ' *' : '') + '</label><input class="inp" data-k="f.last" autocomplete="off" autocapitalize="words" value="' + esc(F.last) + '"></div></div>' +
      '<div class="field"><label>' + t('Consumer Full Name (Auto)') + '</label><input class="inp" id="nm-full" readonly value="' + esc(n) + '"></div>' +
      '<div class="inprow"><div class="field" style="flex:1"><label>' + t('Email') + ' *</label><input class="inp" data-k="f.email" type="email" autocomplete="off" autocapitalize="off" value="' + esc(F.email) + '"></div>' +
      '<div class="field" style="flex:1"><label>' + t('Mobile') + ' *</label><input class="inp mono" data-k="f.mobile" inputmode="tel" maxlength="10" value="' + esc(F.mobile) + '"></div></div>' +
      '<div class="field"><label>' + t('Reason') + ' *</label><select class="inp" data-k="f.reason"><option value="">' + t('Select') + '</option>' + F.reasons.map(function (x) { return '<option ' + (F.reason === x ? 'selected' : '') + ' value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('') + '</select></div></div>' +
      (!titles.length || !F.reasons.length ? '<div class="warn">' + ic('alert', 16) + '<div>' + t('The Official Page Did Not Give The Full Title Or Reason List. Open The Official Page For This Step.') + '</div></div>' : '') +
      '<button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.page1Next()">' + t('Next') + ' ' + ic('right', 18) + '</button>' + fallbackLink();
    return { body: body, title: t('Change Of Name') };
  };
  NAUI.page1Next = async function () {
    readInputs(); var F = NA.f;
    if (!F.title) return fail(t('Select A Title'));
    if (!F.first.trim()) return fail(t('Enter The First Name'));
    if (NA.f.req.last && !F.last.trim()) return fail(t('Enter The Last Name'));
    if (fullName().length > P.NAME_MAX) return fail(t('Name Is Longer Than 50 Characters'));
    if (!P.validEmail(F.email)) return fail(t('Enter A Valid Email'));
    if (!P.validMobile(F.mobile)) return fail(t('Enter A Valid 10 Digit Mobile Number'));
    if (!F.reason) return fail(t('Select A Reason'));
    busy(t('Filling The Official Form...')); NA.failed = [];
    await fillSite('Title', SP.title, F.title, true);
    await fillSite('First Name', SP.first, F.first.trim(), true);
    if (F.middle.trim()) await fillSite('Middle Name', SP.middle, F.middle.trim(), true);
    if (F.last.trim()) await fillSite('Last Name', SP.last, F.last.trim(), true);
    await fillSite('Email', SP.email, F.email.trim(), true);
    await fillSite('Mobile', SP.mobile, F.mobile.trim(), true);
    await fillSite('Reason', SP.reason, F.reason, true);
    var full = await Drv.d('read', SP.full).catch(function () { return null; });
    F.siteFull = full && full.ok ? String(full.value || '') : '';
    if (full && full.ok && F.siteFull.trim().toLowerCase() !== fullName().toLowerCase()) {
      diag('field', 'full name compare', false, 'site shows "' + F.siteFull + '" app composed "' + fullName() + '"');
      if (!full.ro) await fillSite('Full Name', SP.full, fullName(), false);
    } else diag('field', 'full name compare', true, F.siteFull);
    if (NA.failed.length) return fail(t('Could Not Fill On The Official Page') + ': ' + NA.failed.join(', ') + '.');
    await NAUI.loadAadhaar();
  };

  /* ---- page 2: Aadhaar (only what the official page offers) ---- */
  NAUI.loadAadhaar = async function () {
    var s = await snap(); var A = NA.aad;
    A.consent = false; A.sent = false; A.mobile = ''; A.msg = ''; A.verified = false; A.no = ''; A.otp = ''; A.done = false;
    var cons = await Drv.d('has', SP.aadConsent).catch(function () { return { ok: false }; });
    var no = await Drv.d('has', SP.aadNo).catch(function () { return { ok: false }; });
    A.siteHas = !!(cons && cons.ok) || !!(no && no.ok);
    A.hasNo = !!(no && no.ok);
    var low = (s && s.text || '').split(/\n/).filter(function (l) { return /aadhaar|aadhar/i.test(l); });
    A.note = (low.filter(function (l) { return /optional|mandatory|compulsory|required/i.test(l); })[0] || low[0] || '').slice(0, 260);
    A.optional = /optional/i.test(A.note) || !A.hasNo;
    diag('page', 'aadhaar section', A.siteHas, 'consent=' + !!(cons && cons.ok) + ' number=' + A.hasNo + ' optional=' + A.optional);
    NA.busy = ''; setStep('aadhaar');
  };
  NAUI.views.aadhaar = function () {
    var A = NA.aad;
    var body = stepsBar() + errBox() + busyBox() + '<div class="sec">' + t('Aadhaar Authentication') + '</div>';
    if (!A.siteHas) {
      body += '<div class="card empty">' + ic('shield', 28) + '<div>' + t('The Official Page Has No Aadhaar Step For This Consumer.') + '</div></div>';
    } else {
      body += (A.note ? '<div class="card small" style="color:var(--acc)">' + esc(A.note) + '</div>' : '') +
        '<div class="card">' + tick('aad.consent', t('I Give My Consent To Use Aadhaar For Authentication.'), A.consent) + '</div>';
      if (A.consent && A.hasNo) {
        body += fld(t('Aadhaar Number'), 'aad.no', { mono: 1, inputmode: 'numeric', max: 12 }) +
          '<button id="aad-gen" class="btn pri" ' + (A.no.length === 12 && !NA.busy ? '' : 'disabled') + ' onclick="NAUI.aadGen()">' + t('Generate OTP') + '</button>';
        if (A.sent) {
          body += '<div class="card glow"><div class="tiny muted">' + t('Aadhaar Linked Mobile (As Shown By The Official Site)') + '</div><div class="mono" style="font-size:20px;font-weight:700;margin-top:4px">' + esc(A.mobile || '-') + '</div>' +
            (A.msg ? '<div class="tiny muted" style="margin-top:4px">' + esc(A.msg) + '</div>' : '') + '</div>' +
            fld(t('Aadhaar OTP'), 'aad.otp', { mono: 1, inputmode: 'numeric', max: 8 }) +
            '<button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.aadVerify()">' + t('Verify') + '</button>' +
            (A.verified ? '<div class="chip c-a">' + ic('check', 12) + ' ' + t('Verified') + '</div>' : '');
        }
      } else if (A.consent && !A.hasNo) body += '<div class="small muted">' + t('Consent Noted. The Official Page Asks No Aadhaar Number Here.') + '</div>';
    }
    body += '<div class="btns2"><button class="btn out" onclick="NAUI.back()">' + ic('back', 17) + t('Back') + '</button>' +
      '<button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.aadNext()">' + ((A.optional && !A.verified) ? t('Skip') : t('Next')) + ' ' + ic('right', 17) + '</button></div>' + fallbackLink() + privacy();
    return { body: body, title: t('Aadhaar') };
  };
  NAUI.aadConsent = async function () {
    var A = NA.aad; A.sent = false; A.verified = false; busy(t('Updating The Official Page...'));
    await fillSite('Aadhaar Consent', SP.aadConsent, A.consent, false);
    await sleep(500);
    var no = await Drv.d('has', SP.aadNo).catch(function () { return { ok: false }; });
    A.hasNo = !!(no && no.ok); NA.busy = ''; rerender(true);
  };
  async function aadButtons() {
    var gen = { any: ['generate otp', 'get otp', 'send otp', 'aadhaar otp', 'aadhar otp'], not: ['verify', 'submit'], after: SP.aadNo };
    var ver = { any: ['verify', 'validate', 'authenticate', 'confirm otp', 'submit otp'], not: ['generate', 'resend'], after: SP.aadNo };
    return { gen: gen, ver: ver };
  }
  NAUI.aadGen = async function () {
    readInputs(); var A = NA.aad; if (A.no.length !== 12) return;
    busy(t('Asking The Official Site To Send The Aadhaar OTP...'));
    var before = (await snap() || {}).text || '';
    await fillSite('Aadhaar Number', SP.aadNo, A.no, true);
    var b = await aadButtons();
    var a = await act('click Aadhaar Generate OTP', function () { return Drv.d('click', b.gen); }, 6000);
    if (a.r && a.r.ok === false) return fail(t('Could Not Find The Aadhaar Generate OTP Button'));
    await sleep(900);
    var s = await snap(); var delta = deltaLines(before, s && s.text).join(' \u2022 ');
    var all = a.msgs.concat([delta]).join(' ');
    A.mobile = P.aadhaarMobileText(all); A.msg = (a.msgs.join(' ') || delta).slice(0, 240); A.sent = true;
    diag('aadhaar', 'otp sent', !!A.mobile, 'mobile shown: ' + (A.mobile ? 'yes' : 'no'));
    var errs = siteErrors(s, []);
    NA.busy = ''; if (!A.mobile && !A.msg && errs.length) A.msg = errs[0]; rerender(true);
  };
  NAUI.aadVerify = async function () {
    readInputs(); var A = NA.aad; if (!A.otp.trim()) return fail(t('Enter The OTP'));
    busy(t('Verifying With The Official Site...'));
    var before = (await snap() || {}).text || '';
    var f = await Drv.d('fill', { tag: 'input', any: ['aadhaar otp', 'aadhar otp', 'aadotp', 'otp'], notType: NOT_BOX, editable: true, after: SP.aadNo }, A.otp.trim());
    diag('field', 'Aadhaar OTP', f && f.ok, (f && f.err) || '');
    if (!f || !f.ok) return fail(t('Could Not Find The Aadhaar OTP Box'));
    var b = await aadButtons();
    var a = await act('click Aadhaar Verify', function () { return Drv.d('click', b.ver); }, 6000);
    await sleep(800);
    var s = await snap(); var delta = deltaLines(before, s && s.text).join(' \u2022 ');
    var said = (a.msgs.join(' ') + ' ' + delta).trim();
    A.msg = said.slice(0, 240); wipeAad(); A.no = '';
    A.verified = /verif|success|authenticat|valid/i.test(said) && !/not|fail|wrong|invalid|incorrect/i.test(said);
    NA.busy = ''; if (!A.verified && !said) NA.err = t('No Answer From The Official Site. Check And Try Again.'); rerender(true);
  };
  // Aadhaar number and OTP live only while this page is open: wipe the boxes too, or the next re-render would read them back
  function wipeAad() { var A = NA.aad; A.no = ''; A.otp = ''; Array.prototype.forEach.call(root().querySelectorAll('[data-k^="aad."]'), function (e) { if (e.type !== 'checkbox') e.value = ''; }); }
  NAUI.aadNext = function () { readInputs(); wipeAad(); NA.busy = ''; NAUI.toConfirm(); };

  /* ---- page 3: declaration, place, OTP, submit ---- */
  NAUI.toConfirm = async function () {
    var s = await snap(); var P3 = NA.p3;
    P3.otpFields = otpFieldsOf(s || { fields: [] }).map(function (f) { return { i: f.i, label: f.label || f.id || f.name, id: f.id, name: f.name }; });
    P3.sent = false; P3.otp = {}; P3.msg = '';
    setStep('confirm');
  };
  NAUI.views.confirm = function () {
    var P3 = NA.p3, F = NA.f;
    var body = stepsBar() + errBox() + busyBox() +
      '<div class="card"><div class="kv">' + t('New Name') + ': <b>' + esc(fullName()) + '</b></div><div class="kv">' + t('Consumer No') + ': <b class="mono">' + esc(NA.sel) + '</b></div><div class="kv">' + t('Reason') + ': <b>' + esc(F.reason) + '</b></div>' +
      '<div class="kv">' + t('Email') + ': <b>' + esc(F.email) + '</b> \u2022 ' + t('Mobile') + ': <b class="mono">' + esc(F.mobile) + '</b></div></div>' +
      '<div class="card">' + tick('p3.agree', t('I Agree To The Declaration And Terms And Conditions.'), P3.agree) + '</div>' +
      fld(t('Place'), 'p3.place', { cap: 'words' }) +
      '<button class="btn out" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.genOtp()">' + ic('msg', 17) + (P3.sent ? t('Resend OTP') : t('Generate OTP (Mobile + Email)')) + '</button>';
    if (P3.sent) {
      body += (P3.msg ? '<div class="card small acc">' + esc(P3.msg) + '</div>' : '');
      body += P3.otpFields.length ? P3.otpFields.map(function (f) {
        return '<div class="field"><label>' + esc(String(f.label).replace(/[:*]+\s*$/, '').trim() || t('OTP')) + '</label><input class="inp mono" data-otp="' + f.i + '" inputmode="numeric" maxlength="8" autocomplete="off" value="' + esc(P3.otp[f.i] || '') + '"></div>';
      }).join('') : '<div class="warn">' + ic('alert', 16) + '<div>' + t('No OTP Box Found On The Official Page. Open The Official Page For This Step.') + '</div></div>';
    }
    body += '<div class="btns2"><button class="btn out" onclick="NAUI.back()">' + ic('back', 17) + t('Back') + '</button><button class="btn pri" ' + (NA.busy || !P3.sent ? 'disabled' : '') + ' onclick="NAUI.submit()">' + t('Submit To MSEDCL') + '</button></div>' +
      '<div class="tiny muted" style="text-align:center">' + t('Nothing Is Sent To MSEDCL Until You Tap Submit And Confirm.') + '</div>' + fallbackLink();
    return { body: body, title: t('Declaration And Submit') };
  };
  NAUI.genOtp = async function () {
    readInputs(); var P3 = NA.p3;
    busy(t('Asking The Official Site To Send The OTP...'));
    var before = (await snap() || {}).text || '';
    var a = await act('click Generate OTP', function () { return Drv.d('click', { any: ['generate otp', 'get otp', 'send otp', 'resend otp'], not: ['aadhaar', 'aadhar', 'verify', 'submit'], last: true }); }, 6000);
    if (a.r && a.r.ok === false) return fail(t('Could Not Find The Generate OTP Button'));
    await sleep(900);
    var s = await snap();
    var delta = deltaLines(before, s && s.text).join(' \u2022 ');
    P3.msg = (a.msgs.join(' ') || delta).slice(0, 260);
    P3.otpFields = otpFieldsOf(s || { fields: [] }).map(function (f) { return { i: f.i, label: f.label || f.id || f.name, id: f.id, name: f.name }; });
    P3.sent = true; NA.busy = ''; diag('page', 'otp fields', P3.otpFields.length > 0, P3.otpFields.map(function (f) { return f.label; }).join(' / ')); rerender(true);
  };
  NAUI.submit = async function () {
    readInputs(); var P3 = NA.p3;
    if (!P3.agree) return fail(t('Tick The Declaration First'));
    if (!P3.place.trim()) return fail(t('Enter The Place'));
    if (P3.otpFields.some(function (f) { return !String(P3.otp[f.i] || '').trim(); })) return fail(t('Enter The OTP'));
    if (!(await H.confirmBox(t('Submit To MSEDCL?'), t('This Sends The Application To MSEDCL. It Cannot Be Taken Back From The App.') + '<br><br><b>' + esc(fullName()) + '</b>', t('Submit')))) return;
    busy(t('Submitting To MSEDCL...')); NA.failed = [];
    await fillSite('Declaration', SP.declare, true, true);
    await fillSite('Place', SP.place, P3.place.trim(), true);
    for (var k = 0; k < P3.otpFields.length; k++) {
      var f = P3.otpFields[k], r = await Drv.d('fillIdx', f.i, String(P3.otp[f.i]).trim()).catch(function () { return { ok: false }; });
      if (!r || !r.ok) { // the page may have redrawn: find by label instead
        r = await Drv.d('fill', { tag: 'input', any: [f.id, f.name, f.label], notType: NOT_BOX, editable: true }, String(P3.otp[f.i]).trim());
      }
      diag('field', 'OTP ' + f.label, r && r.ok, (r && r.err) || '');
      if (!r || !r.ok) NA.failed.push('OTP');
    }
    if (NA.failed.length) return fail(t('Could Not Fill On The Official Page') + ': ' + NA.failed.join(', ') + '.');
    var a = await act('click Submit (person tapped)', function () { return Drv.d('click', SP.submit); }, 20000);
    if (a.r && a.r.ok === false) return fail(t('Could Not Find The Submit Button'));
    var appNo = '', s = null;
    for (var i = 0; i < 12; i++) {
      s = await snap(); appNo = P.parseAppNo((s && s.text || '') + ' ' + a.msgs.join(' '));
      if (appNo) break;
      var errs = siteErrors(s, a.msgs).filter(function (x) { return !/^(submit|generate otp)$/i.test(x); });
      if (i > 2 && errs.length && !appNo && (await classify()).kind === 'form') break;
      await sleep(900);
    }
    if (!appNo) {
      var e2 = siteErrors(s, a.msgs).filter(function (x) { return x.length > 3; });
      P3.otp = {}; NA.busy = '';
      return fail((e2[0] || t('The Official Site Did Not Confirm The Submission.')) + ' ' + t('Nothing Was Saved. Check The Details.'));
    }
    NA.appNo = appNo; diag('page', 'application number', true, appNo);
    P3.otp = {}; await saveNewApp(); NAUI.toDocs();
  };
  async function saveNewApp() {
    var a = { id: NA.appNo, newName: fullName().toUpperCase(), oldName: (NA.old.filter(function (r) { return /consumer name/i.test(r[0]); })[0] || ['', ''])[1], consumerNo: NA.sel, mobile: NA.custMobile || NA.f.mobile,
      status: 'pending', rawStatus: '', addedAt: Date.now(), appliedAt: Date.now(), reason: NA.f.reason,
      serviceFee: S().settings.mode === 'shop' ? NA.fee : 0, docs: {}, docMode: NA.mode === 'spell' ? 'spell' : 'normal', history: [{ t: Date.now(), text: 'Submitted In App' }], source: 'native' };
    var old = VS.findApp(a.id); if (old) { a.docs = old.docs || {}; }
    VS.upsertApp(a); VS.log('added', 'New Application Submitted - ' + a.id, a.id); VS.changed(); NA.savedId = a.id;
  }

  /* ---- documents (after the application number) ---- */
  var SLOT_RE = { agreement: 'title|agreement|proof|sale|deed|ownership|possession|index', formx: 'form\\s*x|consent|sd\\s*transfer|noc|undertaking', single: 'correction|spelling|proof|document|name' };
  NAUI.toDocs = async function () {
    NA.step = 'docs'; busy(t('Reading The Official Upload Page...')); NA.slots = [];
    try {
      var inputs = await Drv.d('fileInputs').catch(function () { return []; });
      if (!inputs.length) {
        var b = await Drv.d('hasButton', { any: ['upload document', 'upload documents', 'click here', 'attach document', 'upload'], not: ['later'] });
        if (b && b.ok) { await act('open upload page', function () { return Drv.d('click', { any: ['upload document', 'upload documents', 'click here', 'attach document', 'upload'], not: ['later'] }); }, 8000); inputs = await Drv.d('fileInputs').catch(function () { return []; }); }
      }
      diag('page', 'upload slots', inputs.length > 0, inputs.length + ' file inputs');
      var used = {}, spell = NA.mode === 'spell', keys = spell ? ['single'] : ['agreement', 'formx'];
      var app = VS.findApp(NA.appNo) || { docs: {} };
      NA.slots = inputs.map(function (f, i) {
        var hay = f.label + ' ' + f.ctx, key = '';
        keys.forEach(function (k) { if (!key && !used[k] && new RegExp(SLOT_RE[k], 'i').test(hay)) key = k; });
        if (!key && spell && !used.single && i === 0) key = 'single';
        if (key) used[key] = 1;
        return { key: key || ('extra' + i), known: !!key, label: (f.label || f.ctx || t('Document')).replace(/[:*]+\s*$/, '').slice(0, 90), re: key ? SLOT_RE[key] : '', idx: i, file: null, state: '', msg: '' };
      });
      // fill known slots from the vault when already saved
      for (var k = 0; k < NA.slots.length; k++) {
        var sl = NA.slots[k];
        if (sl.known && app.docs && app.docs[sl.key]) { var d = await Native.call('readDoc', { id: NA.appNo, slot: sl.key }).catch(function () { return null; }); if (d) { var bytes = D.bytesFromB64(d.b64); sl.file = { bytes: bytes, size: bytes.length, name: d.name, saved: true }; } }
      }
      NA.busy = ''; rerender(false);
    } catch (e) { fail(e.message || String(e)); }
    NA.step = 'docs'; UI.render(false); bindInputs();
  };
  NAUI.views.docs = function () {
    var body = stepsBar() + '<div class="card glow"><div class="small">' + t('Application Number') + '</div><div class="mono" style="font-size:22px;font-weight:700">' + esc(NA.appNo) + '</div><div class="tiny muted">' + t('Saved In The Applications List.') + '</div></div>' + errBox() + busyBox();
    body += '<div class="sec">' + t('Upload Documents') + '</div>';
    if (!NA.slots.length && !NA.busy) body += '<div class="card empty">' + ic('upload', 28) + '<div>' + t('The App Could Not Find The Upload Slots On The Official Page.') + '</div><div class="tiny">' + t('Use Upload Later, Or Open The Official Page.') + '</div></div>';
    body += NA.slots.map(function (sl, i) {
      var chip = sl.state === 'done' ? '<span class="chip c-a">' + ic('check', 12) + ' ' + t('Uploaded') + '</span>' : sl.state === 'sent' ? '<span class="chip c-p">' + t('Sent, Not Confirmed') + '</span>' : sl.state === 'error' ? '<span class="chip c-r">' + t('Error') + '</span>' : sl.state === 'busy' ? '<span class="chip c-c"><span class="spin"></span></span>' : sl.file ? '<span class="chip c-a">' + t('Ready') + '</span>' : '<span class="chip c-c">' + (sl.known ? t('Required') : t('Optional')) + '</span>';
      return '<div class="card"><div class="row between"><div class="grow"><b style="font-size:13.5px">' + esc(sl.label) + '</b><div class="tiny muted">' + (sl.file ? esc(sl.file.name || '') + ' \u2022 ' + D.fmtSize(sl.file.size) + (sl.file.compressed ? ' (' + t('From') + ' ' + D.fmtSize(sl.file.origSize) + ')' : ' \u2022 ' + t('Not Compressed (Up To 1 MB)')) : t('No File Chosen')) + '</div></div>' + chip + '</div>' +
        (sl.msg ? '<div class="tiny" style="color:var(--cr);margin-top:4px">' + esc(sl.msg) + '</div>' : '') +
        '<div class="row" style="margin-top:8px">' + (sl.state === 'done' ? '' : '<button class="btn ghost sm" onclick="NAUI.pickSlot(' + i + ')">' + ic('file', 14) + (sl.file ? t('Change') : t('Choose File')) + '</button>') +
        (sl.file && sl.state !== 'done' && sl.state !== 'busy' ? '<button class="btn pri sm" onclick="NAUI.upOne(' + i + ')">' + ic('upload', 14) + t('Upload') + '</button>' : '') + '</div></div>';
    }).join('');
    var ready = NA.slots.filter(function (s) { return s.file && s.state !== 'done'; }).length;
    body += '<div class="tiny muted" style="text-align:center">' + t('Files Up To 1 MB Are Not Compressed. Bigger Files Are Gently Compressed To Under 1 MB. File Names Have No Spaces.') + '</div>' +
      (ready > 1 ? '<button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.upAll()">' + ic('upload', 18) + t('Upload All') + '</button>' : '') +
      '<div class="btns2"><button class="btn out" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.docsLater()">' + t('Upload Later') + '</button><button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.toPay()">' + t('Continue To Payment') + ' ' + ic('right', 16) + '</button></div>' + fallbackLink();
    return { body: body, title: t('Documents') };
  };
  NAUI.pickSlot = async function (i) {
    var sl = NA.slots[i], files = await H.pickFiles('files', false); if (!files.length) return;
    sl.state = 'busy'; sl.msg = ''; rerender(true);
    try {
      var r = await D.process(files[0], {});
      var name = sl.known ? P.docName(NA.appNo, sl.key) : P.uploadName(files[0].name.replace(/\.[^.]+$/, '') + '.pdf', 'Document', 'pdf');
      sl.file = { bytes: r.bytes, size: r.size, origSize: r.origSize, compressed: r.compressed, name: name };
      sl.state = '';
      if (sl.known) {
        await Native.call('saveDoc', { id: NA.appNo, slot: sl.key, name: name, b64: D.b64FromBytes(r.bytes) }).catch(function () {});
        var a = VS.findApp(NA.appNo); if (a) { a.docs = a.docs || {}; a.docs[sl.key] = { name: name, size: r.size, origSize: r.origSize, at: Date.now() }; VS.changed(); }
      }
    } catch (e) { sl.state = 'error'; sl.msg = e.message || String(e); }
    rerender(true);
  };
  async function uploadSlot(i, noClick) {
    var sl = NA.slots[i]; if (!sl.file) return false;
    sl.state = 'busy'; sl.msg = ''; rerender(true);
    var b64 = D.b64FromBytes(sl.file.bytes), name = sl.file.name;
    var a = await act('upload ' + sl.label, function () { return Drv.d('uploadTo', { re: sl.re, idx: sl.idx }, name, 'application/pdf', b64, !!noClick); }, noClick ? 600 : 15000);
    if (a.r && a.r.ok === false) { sl.state = 'error'; sl.msg = a.r.err || t('Could Not Upload On The Official Page'); rerender(true); return false; }
    if (noClick) { sl.state = ''; return true; }
    var bad = a.msgs.filter(function (m) { return /size|exceed|invalid|error|fail|not allowed|only|rejected/i.test(m); })[0];
    var s = await snap(), txt = (s && s.text) || '';
    var after = await Drv.d('fileInputs').catch(function () { return []; });
    var still = after.some(function (f) { return new RegExp(sl.re || '$^', 'i').test(f.label + ' ' + f.ctx); });
    var errs = (s && s.msgs || []).filter(function (m) { return /size|exceed|invalid|error|fail|not allowed|only|rejected/i.test(m); });
    if (bad || errs.length) { sl.state = 'error'; sl.msg = bad || errs[0]; }
    else if (txt.indexOf(name) >= 0 || (sl.known && !still) || /success|uploaded/i.test(a.msgs.join(' ') + ' ' + txt.slice(0, 2000))) sl.state = 'done';
    else sl.state = 'sent';
    rerender(true); return sl.state === 'done' || sl.state === 'sent';
  }
  NAUI.upOne = async function (i) { NA.busy = t('Uploading To The Official Site...'); rerender(true); await uploadSlot(i); NA.busy = ''; rerender(true); };
  NAUI.upAll = async function () {
    NA.busy = t('Uploading To The Official Site...'); rerender(true);
    var up = await Drv.d('hasButton', { any: ['upload', 'attach'], not: ['later'] }).catch(function () { return { n: 0 }; });
    var todo = NA.slots.map(function (s, i) { return s.file && s.state !== 'done' ? i : -1; }).filter(function (i) { return i >= 0; });
    var batch = todo.length > 1 && up && up.n && up.n < NA.slots.length;
    if (batch) { for (var j = 0; j < todo.length - 1; j++) await uploadSlot(todo[j], true); await uploadSlot(todo[todo.length - 1], false); NA.slots.forEach(function (s) { if (s.file && s.state === '') s.state = 'sent'; }); }
    else for (var k = 0; k < todo.length; k++) { var ok = await uploadSlot(todo[k]); if (!ok) break; }
    NA.busy = ''; rerender(true);
  };
  NAUI.docsLater = async function () {
    if (!(await H.confirmBox(t('Upload Later?'), t('Your Application Is Saved. Add The Documents Later From Its Details Page (Re-Upload).'), t('Upload Later')))) return;
    NAUI.finishLater();
  };
  NAUI.finishLater = function () { Drv.reset(); var id = NA.appNo; NA = null; UI.stack = []; UI.route = 'detail'; UI.params = { id: id }; UI.render(false); };

  /* ---- payment (official page only) ---- */
  NAUI.toPay = async function () {
    NA.step = 'pay'; var s = await snap();
    NA.payFee = P.feeFromText((s && s.text) || '') || 0;
    diag('page', 'payment', true, 'fee on page: ' + NA.payFee);
    NA.busy = ''; setStep('pay');
  };
  NAUI.views.pay = function () {
    var body = stepsBar() + errBox() + busyBox() +
      '<div class="card glow"><div class="row between"><div><div class="tiny muted">' + t('Processing Fee') + '</div><div style="font-size:26px;font-weight:700" class="acc">' + (NA.payFee ? '\u20B9' + NA.payFee : t('As Shown On The Official Page')) + '</div></div>' + ic('rupee', 30, ' style="stroke:var(--acc)"') + '</div>' +
      '<div class="kv" style="margin-top:8px">' + t('Application Number') + ': <b class="mono">' + esc(NA.appNo) + '</b></div><div class="kv">' + t('New Name') + ': <b>' + esc(fullName()) + '</b></div></div>' +
      '<div class="card small">' + t('The Official MSEDCL Payment Page Opens Inside The App. You Pay Yourself With UPI Or Card. The App Never Sees Your Payment Details.') + '</div>' +
      '<button class="btn pri" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.payNow()">' + ic('rupee', 18) + t('Pay On Official Site') + '</button>' +
      '<button class="btn out" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.toWait()">' + t('I Already Paid. Wait For Receipt') + '</button>' +
      '<button class="btn ghost sm" style="width:100%" onclick="NAUI.finishLater()">' + t('Pay Later') + '</button>';
    return { body: body, title: t('Payment') };
  };
  NAUI.payNow = async function () {
    busy(t('Opening The Official Payment Page...'));
    var h = await Drv.d('hasButton', SP.pay).catch(function () { return { ok: false }; });
    if (h && h.ok) await act('click Pay (person tapped)', function () { return Drv.d('click', SP.pay); }, 15000);
    else diag('click', 'pay button', false, 'not found, showing the page as it is');
    NA.busy = ''; rerender(false);
    await Drv.show(t('Official Payment Page'), []);
    NAUI.toWait();
  };

  /* ---- waiting for the receipt ---- */
  var pollT = null, tickT = null;
  NAUI.toWait = function () {
    clearTimeout(pollT); clearInterval(tickT);
    NA.wait = { until: Date.now() + 5 * 60000, next: 0, status: '', rows: [], polls: 0, done: false, timedOut: false };
    setStep('wait'); NAUI.pollOnce(true);
    tickT = setInterval(function () { var e = root().querySelector('#w-count'); if (!NA || NA.step !== 'wait') { clearInterval(tickT); return; } if (e) e.textContent = fmtLeft(); }, 1000);
  };
  function fmtLeft() { var s = Math.max(0, Math.round((NA.wait.until - Date.now()) / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  NAUI.pollOnce = async function (first) {
    if (!NA || NA.step !== 'wait') return;
    clearTimeout(pollT);
    var W = NA.wait; W.polls++;
    try {
      var s = await snap(), kv = await Drv.d('kv').catch(function () { return []; });
      var st = P.receiptStatus(kv, (s && s.text) || '');
      W.status = st; W.rows = (kv || []).filter(function (r) { return r[1] && !/view|print|download/i.test(r[0]); }).slice(0, 14);
      diag('poll', 'receipt status', true, (st || 'not on receipt page') + ' #' + W.polls);
      if (st === 'success') { W.done = true; return NAUI.finishReceipt(kv, s); }
      if (st === 'failed') { W.done = true; NA.err = t('The Official Site Shows The Payment As Failed. Open The Official Page To Check Or Pay Again.'); rerender(true); return; }
    } catch (e) { diag('poll', 'error', false, e.message || e); }
    if (Date.now() >= W.until) { W.timedOut = true; rerender(true); return; }
    rerender(true);
    pollT = setTimeout(function () { NAUI.pollOnce(); }, window.__vsPollMs || 30000);
  };
  NAUI.views.wait = function () {
    var W = NA.wait;
    var body = stepsBar() + errBox() + '<div class="card glow" style="text-align:center">' + (W.timedOut ? '<div class="acc">' + ic('clock', 34) + '</div><b>' + t('Receipt Not Ready Yet') + '</b><div class="small muted" style="margin-top:4px">' + t('The Bank Or MSEDCL Can Take Longer. Check Again In A Few Minutes.') + '</div>' :
      '<div class="acc"><span class="spin" style="width:30px;height:30px"></span></div><b style="display:block;margin-top:8px">' + t('Waiting For Receipt') + '</b><div class="small muted" style="margin-top:4px">' + t('Checking The Official Page Every 30 Seconds For Up To 5 Minutes.') + '</div><div class="mono acc" style="font-size:24px;margin-top:6px" id="w-count">' + fmtLeft() + '</div>') +
      '<div class="small" style="margin-top:8px">' + t('Status') + ': <b>' + esc(W.status ? (W.status === 'pending' ? t('Pending') : W.status === 'failed' ? t('Failed') : t('Success')) : t('Not Seen Yet')) + '</b></div></div>' +
      (W.rows.length ? '<div class="card" style="padding:4px 12px">' + W.rows.map(function (r) { return '<div class="list-item"><div class="grow small muted">' + esc(r[0]) + '</div><b class="small">' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' : '') +
      '<div class="tiny muted" style="text-align:center">' + t('Keep The App Open. You Will Get A Notification When The Receipt Is Ready.') + '</div>' +
      '<div class="btns2"><button class="btn out" onclick="NAUI.official()">' + ic('ext', 16) + t('Open Official Page') + '</button><button class="btn pri" onclick="NAUI.checkNow()">' + ic('refresh', 16) + t('Check Now') + '</button></div>' +
      '<button class="btn ghost sm" style="width:100%" onclick="NAUI.finishLater()">' + t('Leave And Check Later') + '</button>';
    return { body: body, title: t('Waiting For Receipt') };
  };
  NAUI.checkNow = function () { NA.wait.until = Math.max(NA.wait.until, Date.now() + 60000); NA.wait.timedOut = false; NAUI.pollOnce(); };

  /* ---- receipt: image + PDF, saved in the vault and on the phone ---- */
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  async function makeReceiptImage(rows, logoUrl) {
    var W = 900, pad = 28, rowH = 56, headH = 150, foot = 70, H2 = headH + rows.length * rowH + foot + 20;
    var c = document.createElement('canvas'); c.width = W; c.height = H2; var g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H2);
    g.fillStyle = '#0b3b4e'; g.fillRect(0, 0, W, headH);
    var logo = logoUrl ? await loadImg(logoUrl) : null, x0 = pad;
    if (logo) { var lh = 90, lw = Math.min(200, logo.width * lh / logo.height); g.fillStyle = '#fff'; g.fillRect(pad, 30, lw + 16, lh + 12); g.drawImage(logo, pad + 8, 36, lw, lh); x0 = pad + lw + 36; }
    g.fillStyle = '#ffffff'; g.font = 'bold 26px Arial, sans-serif'; g.fillText('Maharashtra State Electricity', x0, 62); g.fillText('Distribution Co. Ltd.', x0, 96);
    g.font = '20px Arial, sans-serif'; g.fillStyle = '#bfe9f5'; g.fillText('Payment Receipt', x0, 130);
    rows.forEach(function (r, i) {
      var y = headH + i * rowH;
      g.fillStyle = i % 2 ? '#f4f7f9' : '#ffffff'; g.fillRect(pad, y, W - 2 * pad, rowH);
      g.strokeStyle = '#d5dde2'; g.strokeRect(pad, y, W - 2 * pad, rowH); g.beginPath(); g.moveTo(pad + 330, y); g.lineTo(pad + 330, y + rowH); g.stroke();
      g.fillStyle = '#1f2d36'; g.font = 'bold 22px Arial, sans-serif'; g.fillText(String(r[0]).replace(/[:\s]+$/, '').slice(0, 24), pad + 14, y + 36);
      var good = /status/i.test(r[0]) && /succe/i.test(r[1]); g.fillStyle = good ? '#0a7a3d' : '#1f2d36'; g.font = (good ? 'bold ' : '') + '22px Arial, sans-serif';
      var v = String(r[1]); while (g.measureText(v).width > W - 2 * pad - 360 && v.length > 4) v = v.slice(0, -2); g.fillText(v === String(r[1]) ? v : v + '...', pad + 346, y + 36);
    });
    g.fillStyle = '#6b7a85'; g.font = '16px Arial, sans-serif'; g.fillText('Copy of the official MSEDCL receipt page. Saved by VidyutSewa By Yuvraj (independent helper app).', pad, H2 - 34);
    return c.toDataURL('image/jpeg', 0.92);
  }
  function b64OfDataUrl(u) { return String(u).split(',')[1] || ''; }
  function jpegDims(b64) { var bytes = D.bytesFromB64(b64), i = D.jpegInfo(bytes); return { bytes: bytes, w: i && i.w, h: i && i.h }; }
  NAUI.finishReceipt = async function (kv, s) {
    NA.busy = t('Saving The Receipt...'); NA.err = ''; rerender(true);
    try {
      var rows = (kv || []).filter(function (r) { return r[1] && !/view|print|download/i.test(r[0]); }).slice(0, 14);
      if (!rows.length) rows = [[t('Status'), 'Success'], [t('Application Number'), NA.appNo]];
      var lg = await Drv.d('logo').catch(function () { return null; });
      var dataUrl = await makeReceiptImage(rows, lg && lg.ok ? lg.dataUrl : ''), imgB64 = b64OfDataUrl(dataUrl);
      var pdfB64 = '', how = 'app';
      // 1) the official PDF behind "View Receipt" (same session)
      var v = await Drv.d('viewByFetch', SP.viewReceipt).catch(function (e) { return { ok: false, err: e.message }; });
      diag('receipt', 'official pdf by fetch', v && v.ok && /pdf/i.test(v.ct || ''), (v && (v.err || v.ct)) + ' ' + (v && v.how || ''));
      if (v && v.ok && (/pdf/i.test(v.ct || '') || String(atobSafe(v.b64).slice(0, 4)) === '%PDF')) { pdfB64 = v.b64; how = 'official'; }
      // 2) click it and read the address of the window it opens
      if (!pdfB64) {
        await Drv.ev('__vsd.clearOpened()'); await act('click View Receipt', function () { return Drv.d('click', SP.viewReceipt); }, 3000);
        var dr = await Drv.ev('__vsd.drain()').catch(function () { return null; });
        var url = dr && dr.opened && dr.opened[dr.opened.length - 1];
        if (url) { var v2 = await Drv.ev('__vsd.fetchB64(' + JSON.stringify(url) + ')').catch(function () { return null; }); if (v2 && v2.ok && (/pdf/i.test(v2.ct || '') || String(atobSafe(v2.b64).slice(0, 4)) === '%PDF')) { pdfB64 = v2.b64; how = 'official'; } }
      }
      // 3) fall back to a PDF made from the receipt picture (stated plainly in the app)
      if (!pdfB64) { var j = jpegDims(imgB64); pdfB64 = D.b64FromBytes(D.buildPdf([{ bytes: j.bytes, w: j.w, h: j.h }])); how = 'app'; }
      var imgName = P.receiptName(NA.appNo, 'jpg'), pdfName = P.receiptName(NA.appNo, 'pdf');
      var where = {};
      await Native.call('saveDoc', { id: NA.appNo, slot: 'receiptimg', name: imgName, b64: imgB64 });
      await Native.call('saveDoc', { id: NA.appNo, slot: 'receiptpdf', name: pdfName, b64: pdfB64 });
      try { where.img = await Native.call('saveDownload', { name: imgName, b64: imgB64, mime: 'image/jpeg' }); where.pdf = await Native.call('saveDownload', { name: pdfName, b64: pdfB64, mime: 'application/pdf' }); } catch (e) { where.err = e.message; }
      var pick = function (k) { var r0 = rows.filter(function (r) { return k.test(r[0]); })[0]; return r0 ? r0[1] : ''; };
      NA.receipt = { rows: rows, how: how, imgName: imgName, pdfName: pdfName, imgSize: Math.round(imgB64.length * 3 / 4), pdfSize: Math.round(pdfB64.length * 3 / 4), where: where.err ? '' : (where.img && where.img.where) || '', saveErr: where.err || '', imgUrl: dataUrl };
      var a = VS.findApp(NA.appNo);
      if (a) { a.receipt = { at: Date.now(), imgName: imgName, pdfName: pdfName, imgSize: NA.receipt.imgSize, pdfSize: NA.receipt.pdfSize, pdfSource: how, txn: pick(/transaction|txn|payment id|receipt/i), amount: pick(/amount/i), status: 'Success' }; a.history = a.history || []; a.history.push({ t: Date.now(), text: 'Fee Paid - Receipt Saved' }); VS.changed(); VS.log('added', 'Receipt Saved - ' + a.id, a.id); }
      if (S().settings.notify !== false) Native.call('notify', { title: t('Receipt Ready') + ' - ' + NA.appNo, body: t('Payment Successful. Receipt Image And PDF Are Saved.') }).catch(function () {});
      NA.busy = ''; clearTimeout(pollT); clearInterval(tickT); setStep('receipt');
    } catch (e) { NA.busy = ''; NA.err = t('Could Not Save The Receipt') + ': ' + (e.message || e); rerender(true); }
  };
  function atobSafe(b) { try { return atob((b || '').slice(0, 12)); } catch (e) { return ''; } }
  NAUI.views.receipt = function () {
    var R = NA.receipt || { rows: [] };
    var body = stepsBar() + errBox() + '<div class="card glow" style="text-align:center"><div class="acc">' + ic('check', 34) + '</div><b>' + t('Payment Successful') + '</b><div class="tiny muted">' + t('Application Number') + ' ' + esc(NA.appNo) + '</div></div>' +
      (R.imgUrl ? '<img src="' + R.imgUrl + '" style="width:100%;border-radius:12px;border:1px solid var(--line)" onclick="NAUI.viewImg()">' : '') +
      '<div class="card small"><div class="row">' + ic('file', 16) + '<div class="grow">' + esc(R.imgName || '') + ' \u2022 ' + D.fmtSize(R.imgSize || 0) + '</div></div><div class="row" style="margin-top:6px">' + ic('file', 16) + '<div class="grow">' + esc(R.pdfName || '') + ' \u2022 ' + D.fmtSize(R.pdfSize || 0) + '</div></div>' +
      '<div class="tiny muted" style="margin-top:6px">' + t('Saved In The Documents Vault') + (R.where ? ' ' + t('And On The Phone') + ': ' + esc(R.where.replace(/\/[^/]*$/, '')) : '') + '</div>' +
      (R.saveErr ? '<div class="tiny" style="color:var(--cr)">' + esc(R.saveErr) + '</div>' : '') +
      (R.how === 'app' ? '<div class="tiny" style="color:var(--cp);margin-top:4px">' + t('This PDF Was Made By The App From The Receipt. The Official PDF Button Could Not Be Read.') + '</div>' : '<div class="tiny acc" style="margin-top:4px">' + t('PDF Is The Official MSEDCL Receipt.') + '</div>') + '</div>' +
      '<button class="btn wa" onclick="NAUI.shareReceipt()">' + ic('wa', 18) + t('Send Image + PDF On WhatsApp') + '</button>' +
      '<div class="btns2"><button class="btn out" onclick="NAUI.viewImg()">' + ic('image', 16) + t('View Image') + '</button><button class="btn out" onclick="UI.preview(\'' + NA.appNo + '\',\'receiptpdf\',null,\'' + esc(R.pdfName || '') + '\')">' + ic('eye', 16) + t('View PDF') + '</button></div>' +
      '<button class="btn pri" onclick="NAUI.finishLater()">' + t('Done') + '</button>';
    return { body: body, title: t('Receipt') };
  };
  NAUI.viewImg = function () { var R = NA && NA.receipt; if (R && R.imgUrl) UI.sheet('<div class="row between"><h3>' + esc(R.imgName) + '</h3><button class="iconbtn" onclick="UI.closeSheet()">' + ic('x') + '</button></div><img src="' + R.imgUrl + '" style="width:100%">'); };
  async function receiptFiles(id) {
    var i = await Native.call('readDoc', { id: id, slot: 'receiptimg' }), p = await Native.call('readDoc', { id: id, slot: 'receiptpdf' }), out = [];
    if (i) out.push({ name: i.name, b64: i.b64, mime: 'image/jpeg' }); if (p) out.push({ name: p.name, b64: p.b64, mime: 'application/pdf' }); return out;
  }
  NAUI.shareReceiptFor = async function (id, phone) {
    try {
      var files = await receiptFiles(id); if (!files.length) return toast(t('Receipt Files Not Found'));
      var a = VS.findApp(id) || {};
      var shr = await Native.call('share', { files: files, whatsapp: true, phone: phone || a.mobile || '', text: t('Payment Receipt') + ' - ' + id });
      if (shr && shr.note) toast(shr.note, 4500);
    } catch (e) { toast(e.message); }
  };
  NAUI.shareReceipt = function () { return NAUI.shareReceiptFor(NA.appNo, NA.custMobile); };
  UI.shareReceipt = function (id) { return NAUI.shareReceiptFor(id); };
  UI.viewReceiptImg = async function (id) { var i = await Native.call('readDoc', { id: id, slot: 'receiptimg' }); if (i) UI.sheet('<div class="row between"><h3>' + esc(i.name) + '</h3><button class="iconbtn" onclick="UI.closeSheet()">' + ic('x') + '</button></div><img src="data:image/jpeg;base64,' + i.b64 + '" style="width:100%">'); };
  UI.receiptCard = function (a) {
    if (!a || !a.receipt) return '';
    var r = a.receipt;
    return '<div class="sec">' + t('Payment Receipt') + '</div><div class="card"><div class="row between"><div><b class="small">' + t('Fee Paid') + (r.amount ? ' \u2022 ' + esc(r.amount) : '') + '</b><div class="tiny muted">' + esc(r.txn || '') + ' ' + (r.at ? esc(H.fmtDate(r.at)) : '') + '</div></div><span class="chip c-a">' + ic('check', 12) + ' ' + t('Success') + '</span></div>' +
      '<div class="row" style="margin-top:8px"><button class="btn ghost sm" onclick="UI.viewReceiptImg(\'' + a.id + '\')">' + ic('image', 14) + t('Image') + '</button><button class="btn ghost sm" onclick="UI.preview(\'' + a.id + '\',\'receiptpdf\',null,\'' + esc(r.pdfName || 'Receipt') + '\')">' + ic('eye', 14) + 'PDF</button>' +
      '<button class="btn wa sm" onclick="UI.shareReceipt(\'' + a.id + '\')">' + ic('wa', 14) + t('Send On WhatsApp') + '</button></div></div>';
  };

  /* ---- generic step: any page the app cannot match is still shown as native fields ---- */
  NAUI.toGeneric = async function (title, note) {
    var s = await snap();
    NA.gen = { title: title || t('Official Page'), note: note || '', s: s, vals: {} };
    NA.busy = ''; setStep('generic');
  };
  NAUI.views.generic = function () {
    var G = NA.gen || { s: { fields: [], buttons: [], msgs: [], text: '' }, vals: {} }, s = G.s || { fields: [], buttons: [], msgs: [], text: '' };
    var fields = s.fields.filter(function (f) { return f.vis && f.type !== 'file' && !f.dis; });
    var body = errBox() + busyBox() + (G.note ? '<div class="warn">' + ic('info', 16) + '<div>' + esc(G.note) + '</div></div>' : '') +
      (s.msgs.length ? '<div class="card small acc">' + s.msgs.map(esc).join('<br>') + '</div>' : '') +
      '<div class="card small muted" style="max-height:120px;overflow:auto;white-space:pre-wrap;user-select:text">' + esc((s.text || '').slice(0, 700)) + '</div>' +
      fields.map(function (f) {
        var v = G.vals[f.i] != null ? G.vals[f.i] : (f.type === 'checkbox' || f.type === 'radio' ? f.checked : f.value === '(set)' ? '' : f.value);
        var label = esc((f.label || f.id || f.name || t('Field')).replace(/[:*]+\s*$/, ''));
        if (f.type === 'checkbox' || f.type === 'radio') return '<div class="check ' + (v ? 'on' : '') + '" onclick="NAUI.genTick(' + f.i + ')"><span class="box">' + (v ? ic('check', 14) : '') + '</span><span>' + label + '</span></div>';
        if (f.tag === 'select') return '<div class="field"><label>' + label + '</label><select class="inp" data-gi="' + f.i + '">' + f.options.map(function (o) { return '<option ' + (o.t === v || o.v === v ? 'selected' : '') + ' value="' + esc(o.t) + '">' + esc(o.t) + '</option>'; }).join('') + '</select></div>';
        return '<div class="field"><label>' + label + (f.ro ? ' (' + t('Read Only') + ')' : '') + '</label><input class="inp" data-gi="' + f.i + '" ' + (f.ro ? 'readonly' : '') + ' type="' + (f.type === 'password' ? 'password' : 'text') + '" autocomplete="off" value="' + esc(v) + '"></div>';
      }).join('') +
      s.buttons.filter(function (b) { return !b.dis; }).slice(0, 10).map(function (b) { return '<button class="btn out" ' + (NA.busy ? 'disabled' : '') + ' onclick="NAUI.genClick(' + b.i + ')">' + esc(b.t) + '</button>'; }).join('') +
      '<div class="btns2"><button class="btn ghost" onclick="NAUI.back()">' + ic('back', 16) + t('Back') + '</button><button class="btn ghost" onclick="NAUI.genDone()">' + ic('refresh', 16) + t('Continue The Flow') + '</button></div>' + fallbackLink();
    return { body: body, title: (G.title || t('Official Page')) };
  };
  NAUI.genTick = function (i) { readInputs(); var G = NA.gen, f = G.s.fields.filter(function (x) { return x.i === i; })[0], cur = G.vals[i] != null ? G.vals[i] : f.checked; G.vals[i] = !cur; rerender(true); };
  NAUI.genClick = async function (bi) {
    readInputs(); var G = NA.gen; busy(t('Working With The Official Page...'));
    for (var k in G.vals) { var f = G.s.fields.filter(function (x) { return String(x.i) === String(k); })[0]; if (!f || f.ro) continue; await Drv.d('fillIdx', parseInt(k, 10), G.vals[k]).catch(function () {}); }
    var a = await act('generic click', function () { return Drv.d('clickIdx', bi); }, 9000);
    NA.busy = ''; await NAUI.routeByPage(a.msgs);
  };
  NAUI.genDone = function () { return NAUI.routeByPage([]); };
  NAUI.routeByPage = async function (msgs) {
    busy(t('Reading The Official Page...'));
    var w = await classify();
    if (w.kind === 'accounts') { NA.accounts = w.cons.map(function (c) { return { cno: c.cno, text: c.text, cells: c.cells }; }); NA.busy = ''; return setStep('accounts'); }
    if (w.kind === 'form') { await readFormPage(w.s); NA.busy = ''; return setStep('form'); }
    if (w.kind === 'upload' && NA.appNo) return NAUI.toDocs();
    if (w.kind === 'login') { NA.err = t('Session Expired. Please Login Again.'); return NAUI.toLogin(); }
    NA.gen = { title: NA.gen ? NA.gen.title : t('Official Page'), note: (msgs && msgs[0]) || '', s: w.s, vals: {} }; NA.busy = ''; setStep('generic', true);
  };

  /* ---- official page fallback: reveal the same hidden session, with copy buttons for what he typed ---- */
  NAUI.official = async function () {
    var F = NA.f, copy = [];
    function add(l, v) { if (v) copy.push({ l: l, v: String(v) }); }
    add(t('Full Name'), fullName()); add(t('Title'), F.title); add(t('First Name'), F.first); add(t('Middle Name'), F.middle); add(t('Last Name'), F.last);
    add(t('Email'), F.email); add(t('Mobile'), F.mobile); add(t('Place'), NA.p3.place); add(t('Application Number'), NA.appNo); add(t('Consumer No'), NA.sel);
    diag('fallback', 'open official page', true, 'step ' + NA.step);
    await Drv.show(t('Official Page'), copy);
    if (NA.step === 'wait' || NA.step === 'pay' || NA.step === 'receipt') return;
    return NAUI.routeByPage([]);
  };

  /* ---- Diagnostics (hidden: tap the title 5 times, or from an error box) ---- */
  NAUI.diag = async function () {
    NA.dsnap = await snap().catch(function () { return null; });
    UI.go('nadiag');
  };
  UI.screens.nadiag = function () {
    var s = (NA && NA.dsnap) || null, log = ((NA && NA.diag) || []).slice().reverse();
    var body = '<div class="card small"><b>' + t('Diagnostics') + '</b><div class="muted tiny">' + t('Take A Screenshot Of This Screen And Send It To The Developer.') + '</div></div>';
    if (s) body += '<div class="card tiny" style="user-select:text"><b>' + t('Current Official Page') + '</b><br>' + esc(s.title || '') + '<br>' + esc((s.url || '').replace(/[?#].*$/, '')) +
      '<br><br><b>' + t('Fields') + ':</b> ' + s.fields.map(function (f) { return esc((f.label || f.id || f.name) + (f.ro ? ' [ro]' : '') + ' <' + f.type + '>'); }).join('; ') +
      '<br><br><b>' + t('Buttons') + ':</b> ' + s.buttons.map(function (b) { return esc(b.t); }).join('; ') + '</div>';
    body += '<div class="sec">' + t('Step Log') + '</div><div class="card tiny" style="user-select:text;padding:6px 10px">' + (log.length ? log.slice(0, 60).map(function (d) {
      return '<div style="padding:4px 0;border-bottom:1px solid var(--line);color:' + (d.ok ? 'inherit' : 'var(--cr)') + '">' + (d.ok ? '\u2714' : '\u2716') + ' <b>' + esc(d.step) + '</b> \u2022 ' + esc(d.kind) + ': ' + esc(d.what) + (d.detail ? '<br><span class="muted">' + esc(d.detail) + '</span>' : '') + '</div>';
    }).join('') : t('Nothing Yet')) + '</div>' +
      '<div class="btns2"><button class="btn out" onclick="NAUI.copyReport()">' + ic('copy', 16) + t('Copy Report') + '</button><button class="btn out" onclick="UI.back();NAUI.official()">' + ic('ext', 16) + t('Open Official Page') + '</button></div>';
    return page(hdrBack(t('Diagnostics'), ''), body, false);
  };
  NAUI.copyReport = function () {
    var s = NA.dsnap, rep = 'VidyutSewa 1.1.0 diagnostics\nstep: ' + NA.step + '\n' + (s ? 'page: ' + s.title + ' ' + (s.url || '').replace(/[?#].*$/, '') + '\nfields: ' + s.fields.map(function (f) { return (f.label || f.id || f.name) + '<' + f.type + '>'; }).join('; ') + '\nbuttons: ' + s.buttons.map(function (b) { return b.t; }).join('; ') + '\n' : '') +
      NA.diag.slice(-60).map(function (d) { return (d.ok ? 'OK ' : 'FAIL ') + d.step + ' ' + d.kind + ' ' + d.what + ' ' + d.detail; }).join('\n');
    Native.call('copy', { text: rep }).then(function () { toast(t('Copied')); }).catch(function () {});
  };

  /* ---- back button inside the flow ---- */
  NAUI.back = function () {
    if (!NA) return oldBack();
    if (NA.busy) { toast(t('Please Wait')); return true; }
    var s = NA.step, prev = { form: 'accounts', aadhaar: 'form', confirm: 'aadhaar', generic: NA.back || 'accounts', login: 'start', accounts: null };
    if (prev[s]) { setStep(prev[s]); return true; }
    var submitted = !!NA.appNo;
    if (s === 'start') { NA = null; return oldBack(); }
    H.confirmBox(submitted ? t('Leave This Screen?') : t('Leave New Application?'), submitted ? t('Your Application Is Saved. You Can Continue From Its Details Page.') : t('Nothing Has Been Submitted To MSEDCL Yet.'), t('Leave')).then(function (ok) {
      if (!ok) return;
      clearTimeout(pollT); clearInterval(tickT); Drv.reset();
      if (submitted) return NAUI.finishLater();
      NA = null; oldBack();
    });
    return true;
  };
  window.NAUI_state = function () { return NA; };
})();
