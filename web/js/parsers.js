/* VidyutSewa By Yuvraj - parsers shared by the app UI, the Windows build and the unit tests.
 * Pure functions, no DOM required (regex based, tolerant of markup changes). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VSParse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUS_URL = 'https://css.mahadiscom.in/UI/CHANGENAME/ChangeNameUploadDoc.aspx';
  var BILL_BASE = 'https://mobileapp.mahadiscom.in/App_Requests/';
  var BILL_HEADERS = { 'Client-Os': 'ANDROID', 'Client-Os-Version': '14', 'Client-Version': '12.60', 'Accept': 'application/json' };

  function decodeEntities(s) {
    return String(s || '')
      .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCharCode(parseInt(n, 16)); });
  }
  function clean(html) {
    return decodeEntities(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  }

  function validConsumerNo(s) { return /^\d{12}$/.test(String(s || '').trim()); }
  function validAppId(s) { return /^\d{8}$/.test(String(s || '').trim()); }

  /* ---------- Status classification ---------- */
  // Known wording: "Application Submitted". Approved / rejected wording is not confirmed, so we match broadly
  // and always keep the raw text for display.
  function classifyStatus(raw, docsUploaded) {
    var s = String(raw || '').toLowerCase();
    if (!s) return 'pending';
    if (/(reject|return(ed)? to|cancel|deficien|incomplete|not approved|disapprov|re-?upload|resubmit|declin|invalid doc)/.test(s)) return 'rejected';
    if (/(approv|sanction|complet|name chang(ed|e done)|certificate (issued|generated)|provisional certificate|closed|success)/.test(s)) return 'approved';
    return 'pending';
  }

  /* ---------- Change Of Name status page (css.mahadiscom.in ChangeNameUploadDoc.aspx) ---------- */
  function rowsOf(tableHtml) {
    var rows = [], m, re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    while ((m = re.exec(tableHtml))) {
      var cells = [], c, cre = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      while ((c = cre.exec(m[1]))) cells.push(clean(c[1]));
      if (cells.length) rows.push(cells);
    }
    return rows;
  }
  function tableById(html, id) {
    var i = html.search(new RegExp('<table[^>]*id="' + id + '"', 'i'));
    if (i < 0) return '';
    // naive but fine for these flat ASP.NET tables: up to the next closing </table>
    var j = html.indexOf('</table>', i);
    return j < 0 ? html.slice(i) : html.slice(i, j + 8);
  }
  function normKey(k) { return String(k || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

  function parseStatusPage(html) {
    html = String(html || '');
    var out = { ok: false, found: false, applicationId: '', applicationDate: '', consumerNo: '', oldName: '', newName: '',
      mobile: '', category: '', serviceType: '', tariff: '', reason: '', zone: '', circle: '', subDivision: '',
      docsUploaded: null, rawStatus: '', status: 'pending', fee: '', feeItems: [], receipts: [], receiptNo: '', receiptDate: '',
      receiptAmount: '', hasUploadForm: false, fileInputs: [], certificateUrl: '', fields: {} };
    if (!/<html|<form|<table/i.test(html)) return out;
    out.ok = true;
    var info = tableById(html, 'DVConsumerInfo');
    var rows = rowsOf(info || '');
    if (!rows.length) {
      // fall back: any 2-cell row whose first cell looks like a known label
      rows = rowsOf(html).filter(function (r) { return r.length === 2 && /application id|consumer no|consumer name|application status/i.test(r[0]); });
    }
    rows.forEach(function (r) {
      if (r.length < 2) return;
      var k = normKey(r[0]), v = r[1];
      out.fields[r[0].replace(/\s+/g, ' ').trim()] = v;
      if (/^application id/.test(k)) out.applicationId = (v.match(/\d{6,}/) || [v])[0];
      else if (/^application date/.test(k)) out.applicationDate = v;
      else if (/^consumer no/.test(k)) out.consumerNo = (v.match(/\d{9,}/) || [v])[0];
      else if (/^old consumer name/.test(k)) out.oldName = v;
      else if (/^new consumer name/.test(k)) out.newName = v;
      else if (/^mobile/.test(k)) out.mobile = v;
      else if (/^category/.test(k)) out.category = v;
      else if (/^service type/.test(k)) out.serviceType = v;
      else if (/^tariff/.test(k)) out.tariff = v;
      else if (/reason/.test(k)) out.reason = v;
      else if (/^region/.test(k)) out.zone = v;
      else if (/^circle/.test(k)) out.circle = v;
      else if (/^bu|sub division/.test(k)) out.subDivision = v;
      else if (/documents/.test(k)) { var n = v.match(/\d+/); out.docsUploaded = n ? +n[0] : null; }
      else if (/application status|^status/.test(k)) out.rawStatus = v;
    });
    var st = html.match(/id="[^"]*lblApplicationStatus"[^>]*>([\s\S]*?)<\/span>/i);
    if (st && clean(st[1])) out.rawStatus = clean(st[1]);
    out.found = !!(out.applicationId || out.consumerNo || out.rawStatus);
    out.status = classifyStatus(out.rawStatus, out.docsUploaded);

    var est = rowsOf(tableById(html, 'GrvEstDet'));
    est.forEach(function (r) {
      if (r.length >= 2 && r[0] && !/^description$/i.test(r[0])) out.feeItems.push({ description: r[0], amount: r[1] });
    });
    var tot = html.match(/id="GrvEstDet_lblTotal"[^>]*>([\s\S]*?)<\/span>/i);
    if (tot) { var tn = clean(tot[1]).match(/[\d,.]+/); if (tn) out.fee = tn[0].replace(/,/g, ''); }
    else if (out.feeItems.length) out.fee = (out.feeItems[0].amount.match(/[\d.]+/) || [''])[0];

    var rec = rowsOf(tableById(html, 'GrvRecDet'));
    rec.forEach(function (r) {
      if (r.length >= 4 && /\d{6,}/.test(r[1])) out.receipts.push({ description: r[0], number: r[1], date: r[2], amount: r[3] });
    });
    if (out.receipts.length) { out.receiptNo = out.receipts[0].number; out.receiptDate = out.receipts[0].date; out.receiptAmount = out.receipts[0].amount; }

    var fi, fre = /<input[^>]*type=["']?file["']?[^>]*>/gi;
    while ((fi = fre.exec(html))) {
      var nm = (fi[0].match(/name=["']([^"']+)["']/i) || [])[1];
      if (nm) out.fileInputs.push(nm);
    }
    out.hasUploadForm = out.fileInputs.length > 0;
    var cert = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>(?:(?!<\/a>)[\s\S])*?(certificate|\u092a\u094d\u0930\u092e\u093e\u0923\u092a\u0924\u094d\u0930)/i);
    if (cert) out.certificateUrl = absUrl(decodeEntities(cert[1]));
    return out;
  }
  function absUrl(u) {
    if (!u) return '';
    if (/^https?:/i.test(u)) return u;
    if (/^javascript:/i.test(u)) return '';
    if (u.charAt(0) === '/') return 'https://css.mahadiscom.in' + u;
    return 'https://css.mahadiscom.in/UI/CHANGENAME/' + u;
  }
  function statusUrl(appId) { return STATUS_URL + '?applicationno=' + encodeURIComponent(String(appId).trim()); }

  /* ASP.NET form fields needed for a postback (best effort re-upload) */
  function aspFormFields(html) {
    var fields = {}, m, re = /<input([^>]*)>/gi;
    while ((m = re.exec(html))) {
      var a = m[1];
      var type = ((a.match(/type=["']?([a-z]+)/i) || [])[1] || 'text').toLowerCase();
      var name = (a.match(/name=["']([^"']+)["']/i) || [])[1];
      if (!name) continue;
      var val = decodeEntities((a.match(/value=["']([^"']*)["']/i) || [])[1] || '');
      if (type === 'hidden') fields[name] = val;
      else if ((type === 'checkbox' || type === 'radio') && /checked/i.test(a)) fields[name] = val || 'on';
      else if (type === 'text' || type === 'tel' || type === 'number') fields[name] = val;
    }
    var s, sre = /<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
    while ((s = sre.exec(html))) {
      var sel = s[2].match(/<option[^>]*selected[^>]*value=["']([^"']*)["']/i) || s[2].match(/<option[^>]*value=["']([^"']*)["']/i);
      fields[s[1]] = sel ? decodeEntities(sel[1]) : '';
    }
    return fields;
  }
  function uploadButton(html) {
    var m, re = /<input([^>]*type=["']?(?:submit|button|image)["']?[^>]*)>/gi;
    while ((m = re.exec(html))) {
      var name = (m[1].match(/name=["']([^"']+)["']/i) || [])[1];
      var val = decodeEntities((m[1].match(/value=["']([^"']*)["']/i) || [])[1] || '');
      if (name && /upload/i.test(name + ' ' + val)) return { name: name, value: val };
    }
    return null;
  }

  /* ---------- Bill (mobileapp.mahadiscom.in RecentBill / PreviousBill) ---------- */
  function billUrl(cno, yymm) {
    cno = String(cno).trim();
    if (yymm) return BILL_BASE + 'PreviousBill?cat=LT&cno=' + cno + '&mth=' + yymm;
    return BILL_BASE + 'RecentBill?cat=LT&cno=' + cno + '&lookupPaymentsYN=N&lang=en';
  }
  function yymmLabel(yymm) {
    var s = String(yymm || '');
    if (!/^\d{4}$/.test(s)) return s;
    var mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var m = +s.slice(2) - 1;
    return (mons[m] || s.slice(2)) + ' 20' + s.slice(0, 2);
  }
  function prevMonths(yymm, n) {
    var s = String(yymm || ''), out = [];
    if (!/^\d{4}$/.test(s)) return out;
    var y = +s.slice(0, 2), m = +s.slice(2);
    for (var i = 0; i < n; i++) {
      m -= 1; if (m < 1) { m = 12; y -= 1; }
      out.push((y < 10 ? '0' : '') + y + (m < 10 ? '0' : '') + m);
    }
    return out;
  }
  function parseBill(json) {
    var j = json;
    if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return { ok: false, error: 'Invalid Response From Server' }; } }
    if (!j || typeof j !== 'object') return { ok: false, error: 'Empty Response From Server' };
    if (j.consumerExistYN === 'N' || j.validConsumerYN === 'N') return { ok: false, error: 'Consumer Number Not Found', notFound: true };
    var b = j.bill || j.billDetails || null;
    if (!b) return { ok: false, error: j.responseStatus && j.responseStatus !== 'SUCCESS' ? ('Server Says: ' + (j.responseMessage || j.responseStatus)) : 'No Bill Found For This Number' };
    function g(k) { var v = b[k]; return v === undefined || v === null ? '' : String(v).trim(); }
    var prompt = g('promptPayAmount'), amt = g('billAmount');
    var discount = '';
    if (prompt && amt && !isNaN(+prompt) && !isNaN(+amt) && +amt > +prompt) discount = String(Math.round((+amt - +prompt) * 100) / 100);
    var doc = b.billDocument || {};
    return {
      ok: true,
      consumerNo: g('consumerNumber'), name: g('consumerName'), billingUnit: g('billingUnit'), billingUnitName: g('billingUnitName'),
      units: g('consumption'), billMonth: g('billMonthYYMM'), billMonthLabel: yymmLabel(g('billMonthYYMM')),
      billDate: g('billDate'), billNumber: g('billNumber'), amount: amt, dueDate: g('dueDate'), afterDueAmount: g('afterDueDateAmount'),
      promptPayDate: g('promptPayDate'), promptPayAmount: prompt, promptDiscount: discount, status: g('consumerStatus'),
      period: g('billPeriod'), msg: g('msg'), showBill: g('showBillYN') !== 'N',
      pdfUrl: doc.webUrl || doc.url || '', applicableAmountId: j.applicableAmountId || ''
    };
  }

  /* ---------- Application ID capture from the official site ---------- */
  function findApplicationId(text) {
    var s = clean(text);
    var m = s.match(/application\s*(?:id|no\.?|number)\s*(?:is|:|-)?\s*[:\-]?\s*(\d{8})\b/i) ||
            s.match(/\u0905\u0930\u094d\u091c\s*(?:\u0915\u094d\u0930\u092e\u093e\u0902\u0915|\u0915\u094d\u0930\.?|\u0906\u092f\u0921\u0940)\s*[:\-]?\s*(\d{8})\b/) ||
            s.match(/applicationno=(\d{8})/i);
    return m ? m[1] : '';
  }

  /* ---------- Files ---------- */
  // Upload-safe file name: letters, digits, _ and - plus the extension only (the official page rejects spaces and special characters).
  function uploadName(name, fallbackBase, fallbackExt) {
    name = String(name || '');
    var m = name.match(/\.([A-Za-z0-9]{1,5})$/), ext = (m ? m[1] : (fallbackExt || 'pdf')).toLowerCase();
    var base = m ? name.slice(0, name.length - m[0].length) : name;
    base = base.normalize ? base.normalize('NFKD') : base;
    base = base.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_{2,}/g, '_').replace(/^[_-]+|[_-]+$/g, '').slice(0, 60);
    return (base || fallbackBase || 'Document') + '.' + ext;
  }
  // how many PDFs an application needs: 'spell' = Spelling Correction (1 PDF), otherwise Agreement + Form X (2 PDFs)
  function docSlots(mode) { return mode === 'spell' ? ['single'] : ['agreement', 'formx']; }
  function docName(id, slot) {
    var base = slot === 'formx' ? 'FormX' : slot === 'single' ? 'SpellingCorrection' : 'Agreement';
    return uploadName(base + '_' + id + '.pdf', 'Document', 'pdf');
  }
  function safeFileName(name, fallback) {
    var n = String(name || '').replace(/\.[^.]+$/, '');
    n = n.normalize ? n.normalize('NFKD') : n;
    n = n.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    return n || fallback || 'Document';
  }
  // which slot does a file name look like? 'agreement' | 'formx' | ''
  function guessSlot(name) {
    var n = String(name || '').toLowerCase().replace(/\.[^.]+$/, '');
    var flat = n.replace(/[^a-z0-9]/g, '');
    if (/(xform|formx|form10|formno10|formnox)/.test(flat) || /\bx[\s_\-]*form\b|\bform[\s_\-]*(x|10)\b/.test(n)) return 'formx';
    if (/(agreement|agrement|agreemnt|agrmt|agmt|agrmnt|agr|saledeed|deed|index2|indexii)/.test(flat)) return 'agreement';
    return '';
  }

  function fillTemplate(tpl, d) {
    return String(tpl || '').replace(/\{(\w[\w ]*)\}/g, function (m, k) {
      var key = k.toLowerCase().replace(/\s+/g, '');
      var map = { name: d.name, id: d.id, shopname: d.shopName, consumerno: d.consumerNo, status: d.status, link: d.link, type: d.type, documents: d.type };
      return map[key] !== undefined && map[key] !== null ? map[key] : m;
    });
  }

  function parseMsedclDate(s) {
    // "31-Oct-26", "03-Nov-2026", Marathi month names fall back to null
    var m = String(s || '').trim().match(/^(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{2,4})$/);
    if (!m) return null;
    var mons = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    var mo = mons[m[2].toLowerCase()]; if (mo === undefined) return null;
    var y = +m[3]; if (y < 100) y += 2000;
    return new Date(y, mo, +m[1]).getTime();
  }

  function versionNewer(a, b) { // is a newer than b
    var pa = String(a || '').replace(/^v/i, '').split('.').map(Number), pb = String(b || '').replace(/^v/i, '').split('.').map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) { var x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y; }
    return false;
  }

  return {
    STATUS_URL: STATUS_URL, BILL_HEADERS: BILL_HEADERS, clean: clean, decodeEntities: decodeEntities,
    validConsumerNo: validConsumerNo, validAppId: validAppId, classifyStatus: classifyStatus,
    parseStatusPage: parseStatusPage, statusUrl: statusUrl, aspFormFields: aspFormFields, uploadButton: uploadButton,
    billUrl: billUrl, parseBill: parseBill, yymmLabel: yymmLabel, prevMonths: prevMonths,
    findApplicationId: findApplicationId, safeFileName: safeFileName, uploadName: uploadName, docSlots: docSlots, docName: docName, guessSlot: guessSlot, fillTemplate: fillTemplate,
    parseMsedclDate: parseMsedclDate, versionNewer: versionNewer
  };
});
