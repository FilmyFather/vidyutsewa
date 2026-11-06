/* VidyutSewa By Yuvraj - page driver. Injected into the OFFICIAL MSEDCL page that runs in the hidden session
 * (Android WebView / Electron window). Label-based, tolerant matching: nothing here knows the real field ids.
 * It never submits, uploads or pays by itself: the app calls click() only after the person's own tap. */
(function () {
  'use strict';
  if (window.__vsd && window.__vsd.v === 6) return;
  var D = { v: 6, msgs: [], opened: [], els: [] };
  window.__vsd = D;

  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\/]+/g, '').replace(/\//g, ''); }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) : s; }
  function txt(n) { return clip(n && (n.innerText != null ? n.innerText : n.textContent) || '', 400); }
  function vis(e) {
    if (!e || e.nodeType !== 1) return false;
    if (e.type === 'hidden') return false;
    for (var n = e; n && n.nodeType === 1; n = n.parentElement) {
      var s = window.getComputedStyle(n);
      if (s.display === 'none') return false;
      if (n === e && s.visibility === 'hidden') return false;
    }
    return true;
  }
  // navigation / menu items of the official site (left menu etc.): never a login button, never an error message
  var NAV_SEL = '[id^=leftnav],[id*=leftnav_],[class*=leftnav],[class*=left_nav],[class*=sidebar],[id*=sidebar],nav,[role=navigation],[role=menu],[role=menubar],[id^=menu],[class~=menu],[class*=menu_],[class*=navbar],[id*=topnav],[class*=topnav],footer,[id*=footer]';
  function inNav(el) { try { return !!(el && el.closest && el.closest(NAV_SEL)); } catch (e) { return false; } }
  function prevText(el) {
    // text that sits before the control: same-cell text first, then the previous cell, then further up
    var hop = el;
    for (var d = 0; d < 4 && hop; d++) {
      var p = hop.previousSibling, guard = 0;
      while (p && guard++ < 6) {
        var t2 = clip(p.nodeType === 3 ? p.nodeValue : (p.nodeType === 1 && !/^(INPUT|SELECT|TEXTAREA|BUTTON|SCRIPT|STYLE)$/.test(p.tagName) ? txt(p) : ''), 90);
        if (t2) return t2;
        p = p.previousSibling;
      }
      hop = hop.parentElement;
      if (hop && /^(TR|TABLE|FORM|BODY)$/.test(hop.tagName)) break;
    }
    return '';
  }
  function nextText(el) {
    var l = el.labels && el.labels[0]; if (l) return clip(txt(l), 140);
    var p = el.nextSibling, g = 0;
    while (p && g++ < 4) { var t = clip(p.nodeType === 3 ? p.nodeValue : (p.nodeType === 1 && !/^(INPUT|SELECT|TEXTAREA|BUTTON|SCRIPT)$/.test(p.tagName) ? txt(p) : ''), 140); if (t) return t; p = p.nextSibling; }
    var c = el.closest && el.closest('td,li,div,p'); return c ? clip(txt(c), 140) : '';
  }
  function labelOf(el) {
    var out = [];
    try { if (el.labels && el.labels.length) out.push(txt(el.labels[0])); } catch (e) {}
    if (!out.length && el.id) { var l = document.querySelector('label[for="' + String(el.id).replace(/"/g, '') + '"]'); if (l) out.push(txt(l)); }
    if (!out.length) { var wl = el.closest && el.closest('label'); if (wl) out.push(txt(wl)); }
    var al = el.getAttribute && el.getAttribute('aria-label'); if (al) out.push(al);
    var pt = prevText(el); if (pt) out.push(pt);
    return clip(out.filter(Boolean)[0] || el.getAttribute('placeholder') || el.getAttribute('title') || '', 90);
  }
  function rowCtx(el) { var r = el.closest ? el.closest('tr,li,.form-group,.row,fieldset') : null; return clip(r ? txt(r) : '', 140); }
  function btnText(el) {
    var v = el.tagName === 'INPUT' ? (el.value || el.alt || el.title || '') : (el.innerText || el.textContent || el.value || el.title || el.getAttribute('aria-label') || '');
    return clip(v, 80);
  }
  function isButtonish(el) {
    var tg = el.tagName;
    if (tg === 'BUTTON') return true;
    if (tg === 'INPUT') return /^(button|submit|image|reset)$/i.test(el.type);
    if (tg === 'A') return !!(el.getAttribute('href') || el.getAttribute('onclick'));
    return el.getAttribute('role') === 'button' || (el.hasAttribute('onclick') && !/^(SELECT|TEXTAREA)$/.test(tg));
  }
  function fieldInfo(el, i) {
    var tg = el.tagName.toLowerCase(), ty = (el.type || '').toLowerCase();
    var lab = (ty === 'checkbox' || ty === 'radio') ? (nextText(el) || labelOf(el)) : labelOf(el);
    var o = { i: i, tag: tg, type: tg === 'select' ? 'select' : ty || 'text', id: el.id || '', name: el.name || '', label: lab, ctx: rowCtx(el),
      ph: el.getAttribute('placeholder') || '', ro: !!el.readOnly, dis: !!el.disabled, req: !!el.required, vis: vis(el), max: el.maxLength > 0 && el.maxLength < 100000 ? el.maxLength : 0 };
    if (/password|otp|aadhaar|aadhar|uid/i.test((o.id + o.name + o.label)) && o.type !== 'checkbox' && o.type !== 'radio') o.secret = true;
    if (tg === 'select') o.options = Array.prototype.map.call(el.options, function (x) { return { v: x.value, t: clip(x.text, 80) }; });
    if (ty === 'checkbox' || ty === 'radio') { o.checked = !!el.checked; o.v = el.value; }
    else o.value = o.secret ? (el.value ? '(set)' : '') : clip(el.value, 120);
    return o;
  }
  function allFields(includeHidden) {
    var list = Array.prototype.slice.call(document.querySelectorAll('input,select,textarea'));
    return list.filter(function (e) { return e.type !== 'hidden' && (includeHidden || vis(e)); });
  }
  function allButtons() {
    return Array.prototype.slice.call(document.querySelectorAll('button,input[type=button],input[type=submit],input[type=image],a[href],a[onclick],[role=button]'))
      .filter(function (e) { return vis(e) && btnText(e); });
  }

  // ---------- matching ----------
  function score(c, spec) {
    if (spec.ids && c.id && spec.ids.indexOf(c.id) >= 0) return 200;                 // an exact element id always wins over any label
    var L = norm(c.label), I = norm(c.id), N = norm(c.name), P = norm(c.ph), C = norm(c.ctx), best = 0;
    (spec.any || []).forEach(function (raw) {
      var n = norm(raw); if (!n) return; var s = 0;
      if (L === n) s = 100; else if (I === n || N === n) s = 95; else if (L.indexOf(n) === 0) s = 80; else if (L.indexOf(n) >= 0) s = 65;
      else if (I.indexOf(n) >= 0 || N.indexOf(n) >= 0) s = 55; else if (P.indexOf(n) >= 0) s = 50; else if (C.indexOf(n) >= 0) s = 25;
      if (s > best) best = s;
    });
    (spec.not || []).forEach(function (raw) { var n = norm(raw); if (n && (L.indexOf(n) >= 0 || I.indexOf(n) >= 0 || N.indexOf(n) >= 0)) best -= 200; });
    if (spec.optHas && c.options) {
      var texts = c.options.map(function (o) { return norm(o.t); });
      var hit = spec.optHas.some(function (h) { var n = norm(h); return texts.some(function (t) { return t.indexOf(n) >= 0; }); });
      if (hit) best = Math.max(best, 70) + 30; else if (!spec.any || !spec.any.length) best = 0; else best -= 40;
    }
    return best;
  }
  function candidates(spec) {
    var els = allFields(spec.hidden), res = [];
    els.forEach(function (el, k) {
      var tg = el.tagName.toLowerCase(), ty = (el.type || '').toLowerCase();
      if (spec.tag && spec.tag !== tg) return;
      if (spec.type && spec.type !== (tg === 'select' ? 'select' : ty || 'text')) return;
      if (spec.notType && (spec.notType.indexOf(ty) >= 0)) return;
      if (el.disabled && !spec.disabled) return;
      if (spec.editable && (el.readOnly || el.getAttribute('readonly') != null)) return;
      var info = fieldInfo(el, -1); info.el = el;
      var s = score(info, spec);
      if (s >= (spec.min || 50)) res.push({ s: s, k: k, info: info });
    });
    res = posFilter(res, spec, function (x) { return x.info.el; });
    res.sort(function (a, b) { return spec.last ? b.k - a.k : (spec.after || spec.before || spec.afterIdx != null ? a.k - b.k : (b.s - a.s || a.k - b.k)); });
    return res;
  }
  // spec.after / spec.before: keep only controls that sit after / before another control (found by its own spec) in the page
  function posFilter(res, spec, elOf) {
    if (!spec.after && !spec.before && spec.afterIdx == null) return res;
    var out = res;
    if (spec.afterIdx != null && D.els[spec.afterIdx]) { var ai = D.els[spec.afterIdx]; var f0 = out.filter(function (x) { return !!(ai.compareDocumentPosition(elOf(x)) & 4); }); if (f0.length) out = f0; }
    if (spec.after) { var a = D.find(spec.after).el; if (a) { var f = out.filter(function (x) { return !!(a.compareDocumentPosition(elOf(x)) & 4); }); if (f.length) out = f; } }
    if (spec.before) { var b = D.find(spec.before).el; if (b) { var g = out.filter(function (x) { return !!(b.compareDocumentPosition(elOf(x)) & 2); }); if (g.length) out = g; } }
    return out;
  }
  D.find = function (spec) {
    var c = candidates(spec);
    return { n: c.length, top: c.slice(0, 3).map(function (x) { var i = x.info; return { s: x.s, id: i.id, name: i.name, label: i.label, tag: i.tag }; }), el: c.length ? c[Math.min(spec.nth || 0, c.length - 1)].info.el : null };
  };
  function fire(el, names) { names.forEach(function (n) { try { el.dispatchEvent(new Event(n, { bubbles: true })); } catch (e) {} }); }
  function setNative(el, v) {
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(el, v); else el.value = v;
  }
  function pickOption(el, want) {
    var w = norm(want), opts = Array.prototype.slice.call(el.options), hit = null;
    function t(o) { return norm(o.text); }
    hit = opts.filter(function (o) { return o.value === String(want); })[0] || opts.filter(function (o) { return t(o) === w; })[0] ||
      opts.filter(function (o) { return norm(o.value) === w && w; })[0] ||
      opts.filter(function (o) { return t(o).indexOf(w) === 0 && w; })[0] ||
      opts.filter(function (o) { return w && t(o).indexOf(w) >= 0; })[0] || null;
    return hit;
  }

  // Real typing, character by character, the way a person (or a phone keyboard) does it: focus, keydown, keypress, one 'input' event per
  // character (the official page's Aadhaar box masks itself and rebuilds the hidden number from each single keystroke), keyup, then change + blur.
  function isAadNoBox(el) { return el.id === 'txtAadharNo' || el.name === 'txtAadharNo'; }   // ONLY the number box (the linked-mobile and OTP boxes also carry 'aadhar' in their names)
  function clearTyped(el) {
    try { if (typeof window.clearAadhaarInput === 'function' && isAadNoBox(el)) { window.clearAadhaarInput(); return; } } catch (e) {}
    setNative(el, '');
    try { el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null })); } catch (e) { fire(el, ['input']); }
  }
  function typeReal(el, str) {
    str = String(str);
    el.focus && el.focus();
    clearTyped(el);
    var sent = 0;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (el.maxLength > 0 && el.maxLength < 100000 && el.value.length >= el.maxLength && !isAadNoBox(el)) break;
      var kc = /\d/.test(ch) ? 48 + (+ch) : ch.toUpperCase().charCodeAt(0);
      var init = { key: ch, code: /\d/.test(ch) ? 'Digit' + ch : '', keyCode: kc, which: kc, bubbles: true, cancelable: true };
      var go = el.dispatchEvent(new KeyboardEvent('keydown', init));
      if (!go) continue;                                              // the page refused this key, exactly as it would for a real keypress
      el.dispatchEvent(new KeyboardEvent('keypress', init));
      setNative(el, el.value + ch);
      try { el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' })); } catch (e) { fire(el, ['input']); }
      el.dispatchEvent(new KeyboardEvent('keyup', init));
      sent++;
    }
    fire(el, ['change']);
    el.blur && el.blur(); fire(el, ['blur', 'focusout']);
    return sent;
  }
  function elById(id) { return document.getElementById(id); }
  // Aadhaar number: type it into the official box (exact id first, then the label match), then prove it landed: the official page keeps the
  // real digits in a hidden field. Only lengths ever leave this function, never the number.
  D.fillAadhaar = function (value, spec) {
    var el = elById('txtAadharNo'), via = 'id';
    if (!el || !vis(el)) { var f = D.find(spec || { any: ['aadhaar number', 'aadhar number', 'aadhaar', 'aadhar'], tag: 'input', notType: ['checkbox', 'radio', 'button', 'submit', 'file'], editable: true }); el = f.el; via = 'label'; }
    if (!el) return { ok: false, err: 'aadhaar box not found' };
    var v = String(value == null ? '' : value).replace(/\D/g, '');
    var sent = typeReal(el, v);
    var hid = elById('hdnAadharNum');
    var shown = String(el.value || '').length;
    var hidLen = hid ? String(hid.value || '').length : -1;
    var landed = hid ? (hidLen === v.length) : (String(el.value || '').replace(/\D/g, '') === v);
    return { ok: landed && sent === v.length, via: via, id: el.id, name: el.name, typed: v.length, sent: sent, shown: shown, hidId: hid ? hid.id : '', hidLen: hidLen, masked: !!hid && el.value !== v, landed: landed };
  };
  // State of the official Aadhaar panel after Generate OTP, from exact ids (no number inside).
  D.aadhaarState = function () {
    function val(id) { var e = elById(id); return e ? String(e.value || '') : ''; }
    var mobEl = elById('txtAadharMobNo'), row = elById('trAadharMobNo'), r2 = elById('TR_UIDAI_2'), gen = elById('btnUIDAIGenerateOTP'), ver = elById('btnUIDAIVerifyOTP');
    var rowVis = row ? window.getComputedStyle(row).visibility !== 'hidden' && vis(row) : false;
    return { mob: val('txtAadharMobNo'), mobEditable: !!(mobEl && !mobEl.readOnly && !mobEl.disabled), mobId: mobEl ? mobEl.id : '', rowVis: rowVis, row2Vis: !!(r2 && vis(r2)), last4: val('aadharmobno4digit'),
      genId: gen ? gen.id : '', verId: ver ? ver.id : '', hdnLen: val('hdnAadharNum').length, authed: val('hdnIsAadharAuthenticated') };
  };
  // Typed into the Aadhaar-linked mobile box when the official page leaves it editable (its own check wants the last 4 digits to match)
  D.fillAadhaarMobile = function (value) {
    var el = elById('txtAadharMobNo'); if (!el) return { ok: false, err: 'mobile box not found' };
    if (el.readOnly) return { ok: true, skipped: 'readonly' };
    var v = String(value || '').replace(/\D/g, '').slice(-10); typeReal(el, v);
    return { ok: String(el.value || '').replace(/\D/g, '') === v, len: v.length };
  };
  function applyValue(el, v) {
    var tg = el.tagName.toLowerCase(), ty = (el.type || '').toLowerCase();
    if (tg === 'select') {
      var o = pickOption(el, v); if (!o) return { ok: false, err: 'option not found: ' + clip(v, 40) };
      el.value = o.value; el.selectedIndex = o.index; fire(el, ['input', 'change']); try { if (el.onchange) el.onchange(); } catch (e) {}
      return { ok: true, picked: clip(o.text, 60) };
    }
    if (ty === 'checkbox' || ty === 'radio') {
      var want = (v === true || v === 'true' || v === 1 || v === '1' || v === 'on');
      if (el.checked !== want) el.click();
      return { ok: el.checked === want };
    }
    if (/aadh?a?r|uidai/i.test(el.id + el.name) && /^\d+$/.test(String(v))) { var n = typeReal(el, v); return { ok: n === String(v).length, typed: n }; }
    el.focus && el.focus();
    setNative(el, String(v));
    fire(el, ['input', 'keydown', 'keypress', 'keyup', 'change']);
    el.blur && el.blur(); fire(el, ['blur', 'focusout']);
    return { ok: true, value: el.value === String(v) };
  }
  function brief(i) { return { id: i.id, name: i.name, label: i.label, tag: i.tag, type: i.type, max: i.max }; }
  D.fill = function (spec, value) {
    var f = D.find(spec);
    if (!f.el) return { ok: false, err: 'field not found', tried: spec.any || [], n: 0 };
    var r = applyValue(f.el, value);
    r.matched = brief(fieldInfo(f.el, -1)); r.alt = f.top.slice(1);
    return r;
  };
  D.read = function (spec) {
    var f = D.find(spec); if (!f.el) return { ok: false };
    var el = f.el, ty = (el.type || '').toLowerCase();
    return { ok: true, value: ty === 'checkbox' || ty === 'radio' ? !!el.checked : (el.tagName === 'SELECT' ? clip(el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '', 80) : el.value), ro: !!el.readOnly, matched: brief(fieldInfo(el, -1)) };
  };
  // value of any element by id (hidden fields too): only for small flags such as hdnIsAadharMandatory / hdnIsAadharAuthenticated
  D.hid = function (id) { var e = document.getElementById(id); return e ? { ok: true, v: String(e.value == null ? '' : e.value).slice(0, 40) } : { ok: false, v: null }; };
  D.has = function (spec) { var f = D.find(spec); return f.el ? { ok: true, matched: brief(fieldInfo(f.el, -1)), top: f.top } : { ok: false }; };
  D.options = function (spec) { var f = D.find(spec); if (!f.el || f.el.tagName !== 'SELECT') return { ok: false }; return { ok: true, options: Array.prototype.map.call(f.el.options, function (o) { return { v: o.value, t: clip(o.text, 90) }; }), matched: brief(fieldInfo(f.el, -1)) }; };

  // buttons / links: spec.any matches the visible text
  function btnCandidates(spec) {
    var res = [];
    allButtons().forEach(function (el, k) {
      var t = btnText(el), T = norm(t), I = norm(el.id), N = norm(el.name), s = 0;
      if (spec.noNav && inNav(el)) return;
      if (spec.notIds && el.id && spec.notIds.indexOf(el.id) >= 0) return;                // e.g. the Aadhaar Generate OTP button is never the final-page OTP button                       // menu links such as the left-nav "Login" are never the form's button
      var idHit = false; (spec.ids || []).forEach(function (raw) { if (el.id && el.id === raw) { s = Math.max(s, 200); idHit = true; } });   // exact element id wins over any label
      (spec.any || []).forEach(function (raw) {
        var n = norm(raw); if (!n) return; var x = 0;
        if (T === n) x = 100; else if (I === n || N === n) x = 90; else if (T.indexOf(n) === 0) x = 80; else if (T.indexOf(n) >= 0) x = 65; else if (I.indexOf(n) >= 0 || N.indexOf(n) >= 0) x = 55;
        if (x > s) s = x;
      });
      if (!idHit) (spec.not || []).forEach(function (raw) { var n = norm(raw); if (n && (T.indexOf(n) >= 0 || I.indexOf(n) >= 0)) s -= 200; });   // an exact id is never vetoed by a word in its own name
      if (el.disabled) s -= 30;
      if (s >= 50) res.push({ s: s, k: k, el: el, t: t });
    });
    res = posFilter(res, spec, function (x) { return x.el; });
    res.sort(function (a, b) { return spec.last ? b.k - a.k : (spec.after || spec.before || spec.afterIdx != null ? a.k - b.k : (b.s - a.s || a.k - b.k)); });
    return res;
  }
  D.hasButton = function (spec) { var c = btnCandidates(spec); return c.length ? { ok: true, text: c[0].t, id: c[0].el.id, dis: !!c[0].el.disabled, n: c.length } : { ok: false }; };
  D.click = function (spec) {
    var c = btnCandidates(spec);
    if (!c.length) return { ok: false, err: 'button not found', tried: spec.any || [] };
    var el = c[Math.min(spec.nth || 0, c.length - 1)].el;
    if (el.disabled) return { ok: false, err: 'button disabled', text: c[0].t };
    try { el.scrollIntoView && el.scrollIntoView({ block: 'center' }); } catch (e) {}
    setTimeout(function () { el.click(); }, 0);
    return { ok: true, text: c[0].t, id: el.id };
  };

  // ---------- final page (1.1.4): tick the REAL declaration box, type the Place, prove both before Submit, and mark the page so a navigation is seen ----------
  function declEl(spec) {
    var el = elById('chkAgreementCondition');
    if (el && el.type === 'checkbox') return el;
    var f = D.find(spec || { any: ['agree', 'terms and conditions', 'declare', 'declaration'], not: ['aadhaar', 'aadhar'], type: 'checkbox' });
    return f.el && (f.el.type || '').toLowerCase() === 'checkbox' ? f.el : null;
  }
  // Real click first (the site's own onclick / change handlers run), events as a second try; the answer is what the page itself reports afterwards (.checked)
  D.tickDeclaration = function (want, spec) {
    var el = declEl(spec); if (!el) return { ok: false, err: 'declaration box not found' };
    want = (want !== false); var tries = 0, how = 'already';
    try { el.scrollIntoView && el.scrollIntoView({ block: 'center' }); } catch (e) {}
    while (el.checked !== want && tries < 3) {
      tries++;
      if (tries === 1) { how = 'click'; el.focus && el.focus(); el.click(); }
      else if (tries === 2) { how = 'click+events'; el.checked = want; fire(el, ['click', 'input', 'change']); try { if (typeof el.onclick === 'function') el.onclick(); } catch (e) {} }
      else { how = 'second click'; el.click(); }
    }
    return { ok: el.checked === want, checked: !!el.checked, how: how, tries: tries, id: el.id || el.name || '' };
  };
  D.fillPlace = function (value, spec) {
    var el = elById('txtPlace');
    if (!el || !vis(el)) { var f = D.find(spec || { any: ['place'], tag: 'input', notType: ['checkbox', 'radio', 'button', 'submit', 'file'], editable: true }); el = f.el; }
    if (!el) return { ok: false, err: 'place box not found' };
    var v = String(value == null ? '' : value);
    typeReal(el, v);
    return { ok: String(el.value || '').trim().length > 0, len: String(el.value || '').length, id: el.id || '' };
  };
  // Booleans only (never the values): can the Submit click go out?
  D.submitReady = function (submitSpec, placeSpec) {
    var d = declEl(), pl = elById('txtPlace');
    if (!pl) { var f = D.find(placeSpec || { any: ['place'], tag: 'input', notType: ['checkbox', 'radio', 'button', 'submit', 'file'], editable: true }); pl = f.el; }
    var otps = Array.prototype.slice.call(document.querySelectorAll('input')).filter(function (e) {
      var k = (e.id + ' ' + e.name).toLowerCase(); return /otp/.test(k) && !/aadhaar|aadhar|uidai|captcha/.test(k) && /^(text|tel|number|password|)$/.test((e.type || '').toLowerCase()) && !e.readOnly && !e.disabled && vis(e);
    });
    var bc = btnCandidates(submitSpec || { ids: ['SubmitButton'], any: ['submit'], not: ['otp', 'resubmit', 'back', 'reset', 'cancel'], last: true }), btn = elById('SubmitButton') || (bc.length ? bc[Math.min(0, bc.length - 1)].el : null);
    return { declaration: !!(d && d.checked), declFound: !!d, place: !!(pl && String(pl.value || '').trim()), otpBoxes: otps.length, otp: otps.length ? otps.every(function (e) { return String(e.value || '').trim().length > 0; }) : true, submitBtn: !!btn };
  };
  // A marker that lives only on THIS page: when the site posts the form and loads a new page it is gone (a reloaded form looks just like the old one)
  D.mark = function () { var m = 'vm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); window.__vsdMark = m; return m; };
  D.markAlive = function (m) { return window.__vsdMark === m; };
  D.clickIdx = function (i) { var e = D.els[i]; if (!e || !document.contains(e)) return { ok: false, err: 'gone' }; setTimeout(function () { e.click(); }, 0); return { ok: true }; };
  D.fillIdx = function (i, v) { var e = D.els[i]; if (!e || !document.contains(e)) return { ok: false, err: 'gone' }; return applyValue(e, v); };

  // ---------- snapshot (also feeds the Diagnostics screen and the generic step renderer) ----------
  // visible text of the page body without the navigation / menu / footer parts
  D.mainText = function (n) {
    try {
      var out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), x;
      while ((x = w.nextNode()) && out.join(' ').length < (n || 300) + 200) {
        var par = x.parentElement; if (!par || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(par.tagName)) continue;
        var v = x.nodeValue.replace(/\s+/g, ' ').trim(); if (!v) continue;
        if (!vis(par) || inNav(par)) continue;
        out.push(v);
      }
      return clip(out.join(' '), n || 300);
    } catch (e) { return ''; }
  };
  D.snap = function () {
    D.els = [];
    var fields = allFields(false).map(function (el) { D.els.push(el); return fieldInfo(el, D.els.length - 1); });
    var buttons = allButtons().slice(0, 60).map(function (el) { D.els.push(el); return { i: D.els.length - 1, t: btnText(el), id: el.id || '', name: el.name || '', dis: !!el.disabled, a: el.tagName === 'A', nav: inNav(el) }; });
    var msgs = [], linkTexts = {};
    buttons.forEach(function (b) { var k = norm(b.t); if (k) linkTexts[k] = 1; });
    Array.prototype.slice.call(document.querySelectorAll('[id*=rror],[id*=sg],[id*=lert],[id*=essage],[id*=tatus],[class*=rror],[class*=alert],[class*=essage],[class*=uccess],[class*=ail]')).forEach(function (e) {
      if (!vis(e) || e.querySelector('input,select,textarea,table')) return;
      if (inNav(e) || (e.closest && e.closest('a,button,[role=button]'))) return;     // menu text is not a message ("Complaint Status")
      var t = txt(e); if (!t || t.length >= 300 || msgs.indexOf(t) >= 0) return;
      if (linkTexts[norm(t)]) return;                                                  // same words as a link / button on the page
      msgs.push(t);
    });
    var body = document.body ? String(document.body.innerText || '').replace(/[ \t]+/g, ' ').slice(0, 30000) : '';
    return { url: location.href, title: clip(document.title, 100), text: body, main: D.mainText(600), msgs: msgs.slice(0, 8), fields: fields.slice(0, 120), buttons: buttons, imgs: Array.prototype.slice.call(document.images).filter(vis).slice(0, 10).map(function (m) { return { id: m.id, src: clip(m.src, 120), w: m.naturalWidth, h: m.naturalHeight }; }), ready: document.readyState, forms: document.forms.length };
  };
  D.text = function (n) { return document.body ? clip(document.body.innerText, n || 20000) : ''; };
  D.textHas = function (re, flags) { try { return new RegExp(re, flags || 'i').test(D.text(50000)); } catch (e) { return false; } };

  // ---------- tables ----------
  function cellText(c) {
    var t = txt(c); if (t) return t;
    var i = c.querySelector('input,select,textarea'); if (!i || /^(hidden|checkbox|radio|password|file|button|submit)$/i.test(i.type)) return '';
    return i.tagName === 'SELECT' ? clip(i.options[i.selectedIndex] ? i.options[i.selectedIndex].text : '', 80) : clip(i.value, 120);
  }
  function cellsOf(tr) { return Array.prototype.map.call(tr.children, cellText); }
  D.tables = function () {
    return Array.prototype.slice.call(document.querySelectorAll('table')).filter(vis).slice(0, 30).map(function (t) {
      return Array.prototype.slice.call(t.rows).slice(0, 80).map(cellsOf).filter(function (r) { return r.some(Boolean); });
    });
  };
  // "Label | Value" (or "Label | Value | Label | Value") rows anywhere on the page, plus "Label: value" lines
  D.kv = function () {
    var out = [];
    Array.prototype.slice.call(document.querySelectorAll('tr')).forEach(function (tr) {
      if (!vis(tr) || tr.querySelector('tr')) return;
      var c = cellsOf(tr).map(function (x) { return x.replace(/\s*:\s*$/, ''); });
      if (c.length >= 2 && c.length <= 4 && c.length % 2 === 0) for (var i = 0; i < c.length; i += 2) if (c[i] && c[i + 1] && c[i].length < 60) out.push([c[i], c[i + 1]]);
    });
    return out;
  };
  // My Account: one row per consumer, with a radio button (or a link) that selects it
  D.consumers = function () {
    var out = [];
    Array.prototype.slice.call(document.querySelectorAll('tr')).forEach(function (tr) {
      if (!vis(tr) || tr.querySelector('tr')) return;
      var t = txt(tr), m = t.match(/\b(\d{12})\b/);
      if (!m) return;
      var pick = tr.querySelector('input[type=radio],input[type=checkbox]') || tr.querySelector('a[href],a[onclick]');
      var cells = cellsOf(tr).filter(Boolean);
      // the official list keeps the consumer NAME in the tooltip (title) of the number cell
      var nameCell = Array.prototype.slice.call(tr.cells || []).filter(function (td) { return td.title && td.textContent.indexOf(m[1]) >= 0; })[0] || tr.querySelector('td[title]');
      var nm = nameCell ? clip(nameCell.title, 60) : ''; if (!nm || nm === m[1] || /view|photo|bill/i.test(nm) || /^\d+$/.test(nm)) nm = '';
      D.els.push(pick || tr);
      out.push({ i: D.els.length - 1, cno: m[1], name: nm, cells: cells.slice(0, 8), text: clip(t, 200), radio: !!(pick && pick.type === 'radio'), checked: !!(pick && pick.checked) });
    });
    return out;
  };
  D.selectConsumer = function (cno) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('tr')).filter(function (tr) { return vis(tr) && !tr.querySelector('tr') && txt(tr).indexOf(cno) >= 0; });
    if (!rows.length) return { ok: false, err: 'consumer row not found' };
    var tr = rows[0], pick = tr.querySelector('input[type=radio],input[type=checkbox]') || tr.querySelector('a[href],a[onclick]');
    if (!pick) { tr.click(); return { ok: true, via: 'row' }; }
    if (!pick.checked || pick.tagName === 'A') pick.click();
    return { ok: !!(pick.checked || pick.tagName === 'A'), via: pick.tagName };
  };

  // ---------- captcha ----------
  var NOT_CAP = /refresh|reload|icon|logo|banner|social|facebook|youtube|insta|tweet/i;
  // The real wss page draws the captcha into a <canvas id="captcha"> inside <div id="divCaptcha">; other pages use an <img>.
  function captchaEl() {
    var cvs = Array.prototype.slice.call(document.querySelectorAll('canvas')).filter(function (c) { return vis(c) && c.width >= 50 && c.height >= 18; }), pick = null;
    cvs.forEach(function (c) { if (!pick && (/captcha/i.test(c.id + c.className) || (c.parentNode && /captcha/i.test(c.parentNode.id || '')))) pick = c; });
    if (!pick && cvs.length === 1) pick = cvs[0];
    if (pick) return pick;
    var imgs = Array.prototype.slice.call(document.images).filter(function (m) { return vis(m) && !NOT_CAP.test(m.src + (m.alt || '') + m.id) || vis(m) && /captcha/i.test(m.id + m.name + m.src); });
    imgs.forEach(function (m) { if (!pick && /captcha|verif|security|cap_?img/i.test(m.id + m.name + m.src + (m.alt || '') + (m.className || ''))) pick = m; });
    if (!pick) {
      var inp = D.find({ any: ['captcha', 'enter the code', 'security code', 'txtInput'] }).el;
      if (inp) { var best = null, bd = 1e9; imgs.forEach(function (m) { if (m.naturalWidth > 40 && m.naturalWidth < 400) { var d = Math.abs(m.getBoundingClientRect().top - inp.getBoundingClientRect().top) + Math.abs(m.getBoundingClientRect().left - inp.getBoundingClientRect().left); if (d < bd) { bd = d; best = m; } } }); pick = best; }
    }
    return pick;
  }
  D.captcha = function () {
    var m = captchaEl();
    if (!m) return document.getElementById('divCaptcha') ? { ok: false, err: 'captcha not drawn yet', wait: true } : { ok: false, err: 'no captcha image' };
    var isCanvas = m.tagName === 'CANVAS';
    if (!isCanvas && (!m.complete || !m.naturalWidth)) return { ok: false, err: 'captcha not loaded yet', wait: true };
    try {
      var w = isCanvas ? m.width : m.naturalWidth, h = isCanvas ? m.height : m.naturalHeight;
      var c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(m, 0, 0, c.width, c.height);   // white background, 2x: easier to read
      return { ok: true, dataUrl: c.toDataURL('image/png'), w: w, h: h, id: m.id, kind: isCanvas ? 'canvas' : 'img' };
    } catch (e) { return { ok: false, err: 'captcha unreadable: ' + e.message }; }
  };
  D.refreshCaptcha = function () {
    var b = Array.prototype.slice.call(document.querySelectorAll('button,a,input[type=button],img')).filter(function (e) { return vis(e) && /refresh|reload|newcaptcha/i.test((e.id || '') + (e.name || '') + (e.title || '') + (e.alt || '') + (e.getAttribute('onclick') || '')); })[0];
    if (b) { b.click(); return { ok: true, via: b.id || b.tagName }; }
    var m = captchaEl(); if (m && m.src) { var u = m.src.split('#')[0]; m.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(); return { ok: true, via: 'img.src' }; }
    return { ok: false };
  };

  D.logo = function () {
    var m = Array.prototype.slice.call(document.images).filter(function (i) { return vis(i) && i.naturalWidth > 30 && /logo|mahavitaran|msedcl|header/i.test(i.src + i.id + (i.alt || '')); })[0];
    if (!m) return { ok: false };
    try { var c = document.createElement('canvas'); c.width = m.naturalWidth; c.height = m.naturalHeight; c.getContext('2d').drawImage(m, 0, 0); return { ok: true, dataUrl: c.toDataURL('image/png'), w: c.width, h: c.height }; } catch (e) { return { ok: false }; }
  };
  // ---------- files / downloads ----------
  D.fileInputs = function () {
    return Array.prototype.slice.call(document.querySelectorAll('input[type=file]')).filter(function (e) { return !e.disabled; }).map(function (el) {
      D.els.push(el);
      return { i: D.els.length - 1, id: el.id, name: el.name, label: labelOf(el), ctx: rowCtx(el), vis: vis(el), has: !!(el.files && el.files.length), accept: el.accept || '' };
    });
  };
  D.setFile = function (i, name, mime, b64) {
    var el = D.els[i]; if (!el || el.type !== 'file') return { ok: false, err: 'file input gone' };
    try {
      var bin = atob(b64), arr = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
      var dt = new DataTransfer(); dt.items.add(new File([arr], name, { type: mime || 'application/pdf' }));
      el.files = dt.files; fire(el, ['input', 'change']);
      return { ok: el.files.length === 1, size: arr.length };
    } catch (e) { return { ok: false, err: String(e && e.message || e) }; }
  };
  // sel: {re:'regex source matched on the row text', idx:n}; sets the file, then clicks the nearest Upload button after it (unless noClick)
  D.uploadTo = function (sel, name, mime, b64, noClick) {
    var inputs = D.fileInputs(); if (!inputs.length) return { ok: false, err: 'no file inputs on this page' };
    var pick = null;
    if (sel && sel.re) { var re = new RegExp(sel.re, 'i'); pick = inputs.filter(function (f) { return re.test(f.label + ' ' + f.ctx + ' ' + f.id + ' ' + f.name); })[0]; }
    if (!pick && sel && sel.idx != null) pick = inputs[Math.min(sel.idx, inputs.length - 1)];
    if (!pick) return { ok: false, err: 'upload slot not found', n: inputs.length };
    var r = D.setFile(pick.i, name, mime, b64); r.slot = { label: pick.label, id: pick.id }; if (!r.ok || noClick) return r;
    var c = btnCandidates({ any: ['upload', 'attach', 'save', 'submit'], not: ['later', 'cancel', 'skip', 'back'], afterIdx: pick.i });
    if (!c.length) c = btnCandidates({ any: ['upload', 'attach', 'save'], not: ['later', 'cancel', 'skip', 'back'] });
    if (!c.length) { r.clicked = false; r.err = 'no upload button found'; r.ok = false; return r; }
    var el = c[0].el; r.clicked = btnText(el); setTimeout(function () { el.click(); }, 0); return r;
  };
  function blobToB64(blob) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = rej; r.readAsDataURL(blob); }); }
  // same-session download of a PDF / image the page links to (cookies ride along)
  D.fetchB64 = async function (url) {
    var r = await fetch(url, { credentials: 'include' });
    var b = await r.blob();
    return { ok: r.ok, status: r.status, ct: r.headers.get('content-type') || b.type, size: b.size, b64: await blobToB64(b) };
  };
  // "View Receipt": link -> fetch it; form button -> submit the same form by fetch and read the answer
  D.viewByFetch = async function (spec) {
    var c = btnCandidates(spec); if (!c.length) return { ok: false, err: 'button not found' };
    var el = c[0].el, href = el.tagName === 'A' ? el.href : '';
    if (href && /^https?:/i.test(href) && !/^javascript:/i.test(href)) { var r = await D.fetchB64(href); r.how = 'link'; return r; }
    var on = el.getAttribute('onclick') || '', m = on.match(/(?:window\.open|location\.href\s*=|openReport|showReceipt)\s*\(?\s*['"]([^'"]+)['"]/i);
    if (m) { var u = new URL(m[1], location.href).href; var r2 = await D.fetchB64(u); r2.how = 'onclick-url'; return r2; }
    var form = el.form || el.closest('form');
    if (form) {
      var fd = new FormData(form); if (el.name) fd.append(el.name, el.value || '');
      var act = form.getAttribute('action') ? new URL(form.getAttribute('action'), location.href).href : location.href;
      var method = (form.method || 'post').toUpperCase();
      var resp = method === 'GET' ? await fetch(act + (act.indexOf('?') >= 0 ? '&' : '?') + new URLSearchParams(fd).toString(), { credentials: 'include' }) : await fetch(act, { method: 'POST', body: new URLSearchParams(fd), credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      var b = await resp.blob();
      return { ok: resp.ok, status: resp.status, ct: resp.headers.get('content-type') || b.type, size: b.size, b64: await blobToB64(b), how: 'form' };
    }
    return { ok: false, err: 'could not work out how the button fetches the file' };
  };
  // window.open: keep the address (receipt / popups) instead of opening a window the person cannot see
  var realOpen = window.open;
  D.openPolicy = 'record';
  window.open = function (u) {
    var url = u ? new URL(u, location.href).href : '';
    D.opened.push(url);
    if (D.openPolicy === 'navigate' && url) { setTimeout(function () { location.href = url; }, 0); }
    return { closed: false, focus: function () {}, close: function () {}, document: { write: function () {}, close: function () {} }, location: {} };
  };
  var oa = window.alert, oc = window.confirm, op = window.prompt;
  function recordDialogs() {
    window.alert = function (m) { D.msgs.push({ k: 'alert', t: clip(m, 400), at: Date.now() }); };
    window.confirm = function (m) { D.msgs.push({ k: 'confirm', t: clip(m, 400), at: Date.now() }); return true; };
    window.prompt = function (m, d) { D.msgs.push({ k: 'prompt', t: clip(m, 400), at: Date.now() }); return d || ''; };
  }
  recordDialogs();
  // Revealed (the person is using the official page by hand): real dialogs and real popups. Hidden: recorded.
  D.setReveal = function (on) {
    if (on) { window.alert = oa; window.confirm = oc; window.prompt = op; D.openPolicy = 'navigate'; }
    else { recordDialogs(); D.openPolicy = 'record'; }
    return true;
  };
  D.drain = function () { var m = D.msgs.slice(); D.msgs.length = 0; return { msgs: m, opened: D.opened.slice() }; };
  D.clearOpened = function () { D.opened.length = 0; };
})();
