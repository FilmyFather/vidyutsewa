/* VidyutSewa By Yuvraj - What's New + update check (shared by Android and Windows).
   Privacy: the update check is ONE anonymous GET of a public JSON file. Nothing about the user, device or data is sent.
   Safety: unreachable / garbled / offline / future-dated manifest = FAIL OPEN (the app opens normally, nothing is blocked).
   Only the time of the last check is kept on the device. */
(function () {
  'use strict';
  var R = window.VS_RELEASE, CL = window.VS_CHANGELOG || [];
  var DAY = 86400000, KEY = 'vs-upd-last';
  var t = function (s) { return window.I18N ? I18N.t(s) : s; };
  var H = function () { return UI._h; };
  function esc(s) { return H().esc(s); }

  /* ---------- pure logic (unit tested) ---------- */
  function parseVer(v) {
    var m = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(String(v == null ? '' : v).trim());
    return m ? [+m[1], +m[2], +(m[3] || 0), +(m[4] || 0)] : null;
  }
  function cmp(a, b) {
    var x = parseVer(a), y = parseVer(b); if (!x || !y) return null;
    for (var i = 0; i < 4; i++) { if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; }
    return 0;
  }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s)); if (!m) return null;
    var ms = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(ms);
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? ms : null;
  }
  function safeUrl(u) { return typeof u === 'string' && u.length < 600 && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ''; }
  function parseManifest(text) {
    var j; try { j = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return null; }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
    if (!parseVer(j.latestVersion)) return null;
    var rel = parseDate(j.releasedAt); if (rel === null) return null;
    var g = j.graceDays; if (!(typeof g === 'number' && isFinite(g) && g >= 1 && g <= 365)) g = R.graceDays; g = Math.floor(g);
    var lines = Array.isArray(j.changelog) ? j.changelog.filter(function (x) { return typeof x === 'string' && x.trim(); }).slice(0, 8).map(function (x) { return x.trim().slice(0, 200); }) : [];
    return {
      latestVersion: String(j.latestVersion).replace(/^v/, ''), releasedAt: rel, releasedAtStr: j.releasedAt, graceDays: g,
      minSupported: parseVer(j.minSupported) ? String(j.minSupported).replace(/^v/, '') : '',
      apkUrl: safeUrl(j.apkUrl), installerUrl: safeUrl(j.installerUrl), releaseUrl: safeUrl(j.releaseUrl), changelog: lines
    };
  }
  /* state: none | optional (popup, Later works) | required (full-screen block) */
  function evaluate(m, installed, now) {
    if (!m) return { state: 'none' };
    var c = cmp(m.latestVersion, installed);
    if (c === null || c <= 0) return { state: 'none' };
    var future = m.releasedAt > now + DAY;            // a release date in the future is ignored (grace has not started)
    var deadline = m.releasedAt + m.graceDays * DAY;
    var daysLeft = future ? m.graceDays : Math.max(0, Math.ceil((deadline - now) / DAY));
    var tooOld = !future && m.minSupported && cmp(installed, m.minSupported) < 0;
    if (tooOld || (!future && now >= deadline)) return { state: 'required', daysLeft: 0, deadline: deadline };
    return { state: 'optional', daysLeft: Math.max(1, daysLeft), deadline: deadline };
  }

  /* ---------- network ---------- */
  function fetchManifest() {
    var timer, to = new Promise(function (res) { timer = setTimeout(function () { res(null); }, 8000); });
    var p = Native.call('http', { url: R.manifestUrl, session: 'upd', headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r || r.status !== 200 || typeof r.body !== 'string' || r.body.length > 20000) return null;
        return parseManifest(r.body);
      }).catch(function () { return null; });
    return Promise.race([p, to]).then(function (x) { clearTimeout(timer); return x; });
  }
  function downloadUrl(m) {
    var p = Native.platform;
    return (p === 'android' && m.apkUrl) || (p === 'windows' && m.installerUrl) || m.releaseUrl || R.manifestUrl.replace(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/.*/, 'github.com/$1/$2/releases/latest');
  }
  function safeRoute() { return ['home', 'apps', 'bill', 'docs', 'settings', 'notifs', 'whatsnew', 'mode'].indexOf(UI.route) >= 0; }
  function whenNoSheet(fn, tries) {
    if (!document.querySelector('.sheetwrap')) return fn();
    if ((tries || 0) < 200) setTimeout(function () { whenNoSheet(fn, (tries || 0) + 1); }, 700);
  }

  /* ---------- What's New ---------- */
  function fmtDate(s) { var d = parseDate(s); if (d === null) return s; var x = new Date(d); return x.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getUTCMonth()] + ' ' + x.getUTCFullYear(); }
  function entryHtml(e, cur) {
    return '<div class="wn-v"><b>' + t('Version') + ' ' + esc(e.v) + '</b>' + (e.v === cur ? ' <span class="wn-cur">' + t('Current') + '</span>' : '') + '<span class="tiny muted"> ' + esc(fmtDate(e.date)) + '</span></div>' +
      '<ul class="wn-ul">' + e.items.map(function (i) { return '<li>' + esc(t(i)) + '</li>'; }).join('') + '</ul>';
  }
  function whatsNewBody() { return CL.map(function (e) { return entryHtml(e, R.version); }).join(''); }
  function recent(last) {
    var out = CL.filter(function (e) { return last && cmp(e.v, last) > 0; });
    return out.length ? out : CL.slice(0, 1);
  }
  UI.screens.whatsnew = function () {
    var h = H();
    return h.page(h.hdrBack(t("What's New"), t('Version') + ' ' + R.version), '<div class="card wn">' + whatsNewBody() + '</div>', false);
  };
  function showWhatsNew(last) {
    var w = UI.sheet('<h3>' + t("What's New") + ' - ' + t('Version') + ' ' + esc(R.version) + '</h3><div class="wn wnpop">' + recent(last).map(function (e) { return entryHtml(e, R.version); }).join('') + '</div>' +
      '<div class="btns2"><button class="btn out" id="wn-all">' + t('All Versions') + '</button><button class="btn pri" id="wn-close">' + t('Close') + '</button></div>');
    w.querySelector('#wn-close').onclick = function () { w.remove(); };
    w.querySelector('#wn-all').onclick = function () { w.remove(); UI.go('whatsnew'); };
  }
  function markSeen() {
    var s = VS.state.settings;
    if (s.lastSeenVersion !== R.version) { s.lastSeenVersion = R.version; VS.save(true); }
  }

  /* ---------- popups ---------- */
  function lines(m) { return m.changelog.length ? '<ul class="wn-ul">' + m.changelog.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
  function showOptional(m, ev) {
    if (document.querySelector('.updpop')) return;
    var days = ev.daysLeft === 1 ? t('Update Required In 1 Day') : t('Update Required In {n} Days').replace('{n}', ev.daysLeft);
    var w = UI.sheet('<div class="updpop"><h3>' + t('New Version Available') + '</h3>' +
      '<div class="muted small">' + t('Version {v} Is Ready. You Have Version {c}.').replace('{v}', esc(m.latestVersion)).replace('{c}', esc(R.version)) + '</div>' +
      lines(m) + '<div class="updwarn">' + esc(days) + '</div>' +
      '<div class="tiny muted" style="margin:4px 0 8px">' + t('The Update Check Sends Nothing About You.') + '</div>' +
      '<div class="btns2"><button class="btn out" id="up-later">' + t('Later') + '</button><button class="btn pri" id="up-now">' + t('Update Now') + '</button></div></div>');
    w.querySelector('#up-later').onclick = function () { w.remove(); };
    w.querySelector('#up-now').onclick = function () { UI.ext(downloadUrl(m)); };
  }
  function showRequired(m, ev) {
    if (document.querySelector('.updblock')) return;
    UI.updateBlocked = true;
    UI.closeSheet();
    var r = document.getElementById('root'); if (r) r.style.display = 'none';
    var d = document.createElement('div'); d.className = 'updblock';
    d.innerHTML = '<div class="updbody"><div class="appic"></div><h1>' + t('Update Required') + '</h1>' +
      '<div class="muted">' + t('This Version Is Too Old And Has Stopped Working. Please Update To Continue.') + '</div>' +
      '<div class="small" style="margin-top:10px">' + t('Installed Version') + ': <b>' + esc(R.version) + '</b> &bull; ' + t('Latest Version') + ': <b>' + esc(m.latestVersion) + '</b></div>' +
      lines(m) +
      '<div class="btns2" style="margin-top:18px"><button class="btn out" id="ub-close">' + t('Close') + '</button><button class="btn pri" id="ub-now">' + t('Update Now') + '</button></div></div>' + UI.footer();
    document.body.appendChild(d);
    d.querySelector('#ub-now').onclick = function () { UI.ext(downloadUrl(m)); };
    d.querySelector('#ub-close').onclick = function () { Native.call(Native.platform === 'windows' ? 'quit' : 'exit').catch(function () {}); };
  }

  /* ---------- runners ---------- */
  var lastBack = null;
  function apply(m, opts) {
    var ev = evaluate(m, R.version, opts && opts.now != null ? opts.now : Date.now());
    if (ev.state === 'required') showRequired(m, ev);
    else if (ev.state === 'optional') whenNoSheet(function () { if (!UI.updateBlocked) showOptional(m, ev); });
    return ev;
  }
  function check(opts) {
    opts = opts || {};
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
    return fetchManifest().then(function (m) {
      // launch / daily checks never interrupt a form in progress
      if (!opts.manual && !safeRoute()) return { state: 'skipped' };
      if (!m) return { state: 'unreachable' };
      return apply(m, opts);
    }).catch(function () { return { state: 'unreachable' }; });
  }
  function onLaunch() {
    try {
      var s = VS.state.settings;
      if (!s.onboarded) markSeen();
      else if (s.lastSeenVersion !== R.version) {
        var last = s.lastSeenVersion; markSeen(); showWhatsNew(last);
      }
    } catch (e) { console.error(e); }
    return check({});
  }
  function onForeground() {
    var last = 0; try { last = +localStorage.getItem(KEY) || 0; } catch (e) {}
    if (Date.now() - last > DAY && safeRoute() && !UI.updateBlocked) return check({});
    return Promise.resolve({ state: 'skipped' });
  }
  function manual() {
    var b = document.getElementById('updbtn'); if (b) b.innerHTML = '<span class="spin"></span>';
    return check({ manual: true }).then(function (ev) {
      if (b) b.innerHTML = icon('refresh', 15) + t('Check For Updates');
      if (ev.state === 'none') UI.toast(t('You Have The Latest Version') + ' (' + R.version + ')');
      else if (ev.state === 'unreachable') UI.toast(t('Could Not Check For Updates'));
      return ev;
    });
  }
  UI.checkUpdate = manual;

  var prevBack = UI.back;
  UI.back = function () {
    if (document.querySelector('.updblock')) { Native.call(Native.platform === 'windows' ? 'quit' : 'exit').catch(function () {}); return false; }
    return prevBack.apply(UI, arguments);
  };

  window.VSUpdate = { parseVer: parseVer, cmp: cmp, parseDate: parseDate, parseManifest: parseManifest, evaluate: evaluate, check: check, onLaunch: onLaunch, onForeground: onForeground, manual: manual, showWhatsNew: showWhatsNew, recent: recent, DAY: DAY };
})();
