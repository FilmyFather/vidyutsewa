/* VidyutSewa By Yuvraj - data store + status tracking engine (shared). All data stays on this device. */
(function () {
  'use strict';
  var P = window.VSParse;
  var UA = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  var DAY = 86400000;

  var OLD_TEMPLATE = 'Namaste {Name} \uD83D\uDE4F\nYour Electricity Name Change Application Has Been Submitted.\nApplication ID: {ID}\nTrack Status: https://css.mahadiscom.in/UI/CHANGENAME/ChangeNameUploadDoc.aspx?applicationno={ID}\n- {Shop Name}';
  var DEFAULT_TEMPLATE = 'Namaste {Name} \uD83D\uDE4F\nYour Electricity Name Change Application Has Been Submitted.\nApplication ID: {ID}\nApplication Type: {Type}\nTrack Status: https://css.mahadiscom.in/UI/CHANGENAME/ChangeNameUploadDoc.aspx?applicationno={ID}\n- {Shop Name}';
  function defaults() {
    return {
      v: 1,
      settings: { mode: '', shopName: '', fee: 50, theme: 'dark', themeStyle: 'royal', lang: 'en', notify: true, interval: 30, reminder: true, sound: true,
        quality: 'balanced', autoReupload: true, autoDelete: true, lock: false, pinHash: '', bio: false, waTemplate: DEFAULT_TEMPLATE,
        onboarded: false },
      apps: [], bills: [], activity: [], notes: []
    };
  }
  var state = defaults(), saveTimer = null, changeFns = [];

  function merge(a, b) { for (var k in b) if (!(k in a)) a[k] = b[k]; return a; }
  async function load() {
    try {
      var raw = await Native.call('loadData');
      if (raw) {
        var d = typeof raw === 'string' ? JSON.parse(raw) : raw;
        state = merge(d, defaults()); merge(state.settings, defaults().settings);
        if (state.settings.waTemplate === OLD_TEMPLATE) state.settings.waTemplate = DEFAULT_TEMPLATE;   // older default gets the new Application Type line
      }
    } catch (e) { console.error('load', e); }
    return state;
  }
  function save(now) {
    clearTimeout(saveTimer);
    var go = function () { return Native.call('saveData', { json: JSON.stringify(state) }).catch(function (e) { console.error(e); }); };
    if (now) return go();
    saveTimer = setTimeout(go, 250);
    return Promise.resolve();
  }
  function changed() { save(); changeFns.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function onChange(fn) { changeFns.push(fn); }

  function log(type, text, id) {
    state.activity.unshift({ t: Date.now(), type: type, text: text, id: id || '' });
    if (state.activity.length > 200) state.activity.length = 200;
  }
  function findApp(id) { return state.apps.find(function (a) { return a.id === id; }); }
  function upsertApp(app) {
    var cur = findApp(app.id);
    if (cur) Object.assign(cur, app); else state.apps.unshift(app);
    return findApp(app.id);
  }
  function removeApp(id) {
    state.apps = state.apps.filter(function (a) { return a.id !== id; });
    return Native.call('deleteDocs', { id: id });
  }

  function docMode(a) { return a && a.docMode === 'spell' ? 'spell' : 'normal'; }
  function docSlots(a) { return P.docSlots(docMode(a)); }
  function needDocs(a) { return docSlots(a).length; }
  function typeLabel(a) { return docMode(a) === 'spell' ? 'Spelling Correction In Name' : 'Change Of Name'; }
  function hasDocs(a) { return !!(a.docs && docSlots(a).every(function (s) { return a.docs[s]; })); }
  function appliedAt(a) { return a.appliedAt || a.addedAt || Date.now(); }
  function deadline(a) {
    // MSEDCL asks for documents within 3 days of applying
    if (a.status !== 'pending') return null;
    if (a.docsUploaded != null && a.docsUploaded >= needDocs(a)) return null;   // 1 PDF is enough for a spelling correction
    var end = appliedAt(a) + 3 * DAY;
    return { end: end, left: end - Date.now() };
  }
  function stats(period) {
    var now = new Date(), start;
    if (period === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    else start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    var s = { applied: 0, pending: 0, rejected: 0, approved: 0, earnings: 0 };
    state.apps.forEach(function (a) {
      var t = a.addedAt || 0;
      if (t >= start) { s.applied++; s[a.status] = (s[a.status] || 0) + 1; s.earnings += +(a.serviceFee || 0); }
    });
    return s;
  }

  async function http(url, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'User-Agent': UA }, opts.headers || {});
    var r = await Native.call('http', Object.assign({ url: url, method: 'GET', headers: headers }, opts, { headers: headers }));
    if (!r) throw new Error('No Response');
    return r;
  }
  async function fetchStatus(id) {
    var r = await http(P.statusUrl(id));
    if (r.status >= 400) throw new Error('Official Site Error ' + r.status);
    return P.parseStatusPage(r.body);
  }
  async function fetchBill(cno, yymm) {
    var r = await http(P.billUrl(cno, yymm), { headers: P.BILL_HEADERS });
    if (r.status >= 400) throw new Error('Bill Server Error ' + r.status);
    return P.parseBill(r.body);
  }

  function applyParsed(a, p) {
    if (p.consumerNo) a.consumerNo = p.consumerNo;
    if (p.newName) a.newName = p.newName;
    if (p.oldName) a.oldName = p.oldName;
    if (p.mobile && !a.mobile) a.mobile = p.mobile;
    if (p.applicationDate) { a.applicationDate = p.applicationDate; var t = P.parseMsedclDate(p.applicationDate); if (t) a.appliedAt = t; }
    if (p.docsUploaded !== null) a.docsUploaded = p.docsUploaded;
    if (p.fee) a.fee = p.fee;
    if (p.receiptNo) { a.receiptNo = p.receiptNo; a.receiptDate = p.receiptDate; }
    if (p.reason) a.reason = p.reason;
    if (p.subDivision) a.subDivision = p.subDivision;
    if (p.certificateUrl) a.certUrl = p.certificateUrl;
    a.rawStatus = p.rawStatus || a.rawStatus || '';
  }

  /* One status check. Returns a list of events (for UI toasts). Used by Windows + web; Android runs the same logic natively. */
  async function checkApp(a, opt) {
    opt = opt || {};
    var ev = [];
    var p = await fetchStatus(a.id);
    a.lastChecked = Date.now();
    if (!p.found) { a.lastError = 'Not Found On Official Site'; return ev; }
    a.lastError = '';
    var prev = a.status;
    applyParsed(a, p);
    var next = p.status;
    if (next !== prev) {
      a.status = next;
      a.history = a.history || [];
      a.history.push({ t: Date.now(), text: p.rawStatus || next });
      if (next === 'approved') {
        a.approvedAt = Date.now();
        log('approved', 'Application Approved - ' + a.id, a.id);
        ev.push({ title: 'Application Approved - ' + a.id, body: (a.newName || '') + ' \u2022 Name Change Approved' });
        if (state.settings.autoDelete && a.docs) {
          await Native.call('deleteDocs', { id: a.id }).catch(function () {});
          a.docs = {}; a.docsDeleted = true;
          log('deleted', 'Documents Deleted After Approval - ' + a.id, a.id);
        }
      } else if (next === 'rejected') {
        log('rejected', 'Application Rejected - ' + a.id, a.id);
        ev.push({ title: 'Application Rejected - ' + a.id, body: p.rawStatus || 'Please Check The Application' });
      }
    }
    var needUpload = (a.status === 'rejected' || p.docsUploaded === 0) && a.status !== 'approved';
    var recently = a.lastReuploadAt && (Date.now() - a.lastReuploadAt < 6 * 3600000);
    if (needUpload && state.settings.autoReupload && hasDocs(a) && !recently && !opt.noUpload) {
      ev = ev.concat(await reupload(a, p));
    }
    var dl = deadline(a);
    if (dl && state.settings.reminder && dl.left > 0 && dl.left < DAY && !a.reminded) {
      a.reminded = true;
      ev.push({ title: 'Upload Deadline Today - ' + a.id, body: 'Upload Documents Before The 3-Day Deadline Ends' });
    }
    return ev;
  }

  /* Best effort automatic re-upload through the public upload page (ASP.NET postback).
   * Not verified against a real rejected application; reports failure clearly. */
  async function reupload(a, parsed) {
    var ev = [{ title: 'Re-Uploading Document - ' + a.id, body: (docMode(a) === 'spell' ? 'Uploading The Correction PDF Again' : 'Uploading Agreement And Form X Again') }];
    a.lastReuploadAt = Date.now();
    try {
      var page = await http(P.statusUrl(a.id), { session: 'css' });
      var p = P.parseStatusPage(page.body);
      if (!p.hasUploadForm) throw new Error('Upload Form Not Shown Without Login');
      var fields = P.aspFormFields(page.body);
      var btn = P.uploadButton(page.body);
      if (btn) fields[btn.name] = btn.value;
      var files = [], sl = docSlots(a);
      for (var i = 0; i < sl.length; i++) {
        var dd = await Native.call('readDoc', { id: a.id, slot: sl[i] });
        if (!dd) throw new Error('Saved Documents Missing');
        if (!p.fileInputs[i]) throw new Error('Upload Form Has No Place For This File');
        files.push({ field: p.fileInputs[i], name: P.uploadName(dd.name, 'Document', 'pdf'), mime: 'application/pdf', b64: dd.b64 });
      }
      var post = await http(P.statusUrl(a.id), { method: 'POST', multipart: { fields: fields, files: files }, session: 'css' });
      if (post.status >= 400) throw new Error('Upload Rejected By Site (' + post.status + ')');
      var after = P.parseStatusPage(post.body);
      if (!(after.docsUploaded > (p.docsUploaded || 0))) {
        var chk = await fetchStatus(a.id);
        if (!(chk.docsUploaded > (p.docsUploaded || 0))) throw new Error('Site Did Not Confirm The Upload');
        after = chk;
      }
      applyParsed(a, after);
      a.reuploadState = 'done';
      log('reupload', 'Re-Upload Done - ' + a.id, a.id);
      ev.push({ title: 'Re-Upload Done - ' + a.id, body: docMode(a) === 'spell' ? 'Correction PDF Uploaded Again' : 'Both Documents Uploaded Again' });
    } catch (e) {
      a.reuploadState = 'failed'; a.reuploadError = e.message;
      log('reupload-failed', 'Re-Upload Failed - ' + a.id + ': ' + e.message, a.id);
      ev.push({ title: 'Re-Upload Failed - ' + a.id, body: e.message + '. Tap Re-Upload To Do It On The Official Page.' });
    }
    return ev;
  }

  var syncing = false;
  async function syncAll(opt) {
    if (syncing) return [];
    syncing = true;
    var all = [];
    try {
      if (Native.platform === 'android') {
        await Native.call('syncNow', {});
        await load();
      } else {
        var list = state.apps.filter(function (a) { return a.status !== 'approved'; });
        for (var i = 0; i < list.length; i++) {
          try { all = all.concat(await checkApp(list[i], opt)); } catch (e) { list[i].lastError = e.message; }
        }
        if (state.settings.notify) all.forEach(function (n) { Native.call('notify', { title: n.title, body: n.body, sound: state.settings.sound }); });
      }
      state.lastSync = Date.now();
    } finally { syncing = false; changed(); }
    return all;
  }
  var timer = null;
  function schedule() {
    var s = state.settings;
    if (Native.platform === 'android') { Native.call('schedule', { enabled: s.notify, interval: s.interval || 30, reminder: s.reminder }); return; }
    clearInterval(timer);
    if (s.notify) timer = setInterval(function () { syncAll(); }, Math.max(15, s.interval || 30) * 60000);
  }

  async function sha(s) {
    try {
      var b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vidyutsewa:' + s));
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    } catch (e) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'h' + h; }
  }

  async function exportBackup() {
    var docs = {};
    for (var i = 0; i < state.apps.length; i++) {
      var a = state.apps[i];
      for (var slot of ['agreement', 'formx', 'single']) {
        if (a.docs && a.docs[slot]) {
          var d = await Native.call('readDoc', { id: a.id, slot: slot }).catch(function () { return null; });
          if (d) { docs[a.id] = docs[a.id] || {}; docs[a.id][slot] = d; }
        }
      }
    }
    var st = JSON.parse(JSON.stringify(state)); st.settings.pinHash = ''; st.settings.lock = false;
    return JSON.stringify({ app: 'VidyutSewa', v: 1, at: Date.now(), data: st, docs: docs });
  }
  async function importBackup(text) {
    var b = JSON.parse(text);
    if (!b || b.app !== 'VidyutSewa' || !b.data) throw new Error('Not A VidyutSewa Backup File');
    var keepLock = { lock: state.settings.lock, pinHash: state.settings.pinHash };
    state = merge(b.data, defaults()); merge(state.settings, defaults().settings);
    Object.assign(state.settings, keepLock);
    for (var id in (b.docs || {})) for (var slot in b.docs[id]) {
      var d = b.docs[id][slot];
      await Native.call('saveDoc', { id: id, slot: slot, name: d.name, b64: d.b64 });
    }
    await save(true); changed();
    return state.apps.length;
  }
  async function wipeAll() {
    for (var i = 0; i < state.apps.length; i++) await Native.call('deleteDocs', { id: state.apps[i].id }).catch(function () {});
    var keep = state.settings; state = defaults(); state.settings = keep;
    await save(true); changed();
  }

  window.VS = {
    get state() { return state; }, load: load, save: save, changed: changed, onChange: onChange, log: log,
    findApp: findApp, upsertApp: upsertApp, removeApp: removeApp, hasDocs: hasDocs, deadline: deadline, docMode: docMode, docSlots: docSlots, needDocs: needDocs, typeLabel: typeLabel, OLD_TEMPLATE: OLD_TEMPLATE, stats: stats,
    fetchStatus: fetchStatus, fetchBill: fetchBill, applyParsed: applyParsed, checkApp: checkApp, reupload: reupload,
    syncAll: syncAll, schedule: schedule, sha: sha, exportBackup: exportBackup, importBackup: importBackup, wipeAll: wipeAll,
    DEFAULT_TEMPLATE: DEFAULT_TEMPLATE, UA: UA, DAY: DAY
  };
})();
