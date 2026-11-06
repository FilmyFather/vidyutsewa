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

  /* ---------- New Application (native flow) helpers ---------- */
  var NAME_MAX = 50;
  function oneSpace(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  // v1.1.2: every name is UPPERCASE (the title keeps the official site's own option text)
  function upName(s) { return String(s == null ? '' : s).toUpperCase(); }
  // M/S (a firm / society): ONE single-line name field; First / Middle / Last do not exist for it (the official page hides and blanks them)
  function isMS(title) { return /^\s*m\s*\/\s*s\.?\s*$/i.test(String(title == null ? '' : title)); }
  // Title + First + Middle + Last, joined by single spaces (what the official "Consumer Full Name" box holds).
  // M/S: 'M/S ' + name, trimmed.
  function composeName(title, first, middle, last) {
    if (isMS(title)) return [title, upName(first)].map(oneSpace).filter(Boolean).join(' ');
    return [title, upName(first), upName(middle), upName(last)].map(oneSpace).filter(Boolean).join(' ');
  }
  function nameLength(title, first, middle, last) { return composeName(title, first, middle, last).length; }
  // Block typing past 50: shorten the field being typed in until the whole composed name (Title + spaces + words) fits.
  function clampName(parts, key) {
    var p = { title: parts.title || '', first: upName(parts.first || ''), middle: upName(parts.middle || ''), last: upName(parts.last || '') };
    if (isMS(p.title)) { p.middle = ''; p.last = ''; }
    var guard = 0;
    while (composeName(p.title, p.first, p.middle, p.last).length > NAME_MAX && p[key].length > 0 && guard++ < 200) p[key] = p[key].slice(0, -1);
    return p;
  }
  /* ---------- v1.1.2: Aadhaar checks (done on the phone BEFORE anything is sent to the official site; nothing is stored or logged) ---------- */
  var VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
  var VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
  function verhoeffValid(num) {
    var s = String(num || ''); if (!/^\d+$/.test(s)) return false;
    var c = 0, a = s.split('').reverse();
    for (var i = 0; i < a.length; i++) c = VD[c][VP[i % 8][+a[i]]];
    return c === 0;
  }
  // 12 digits, first digit 2-9, Verhoeff check digit correct
  function validAadhaar(num) { var s = String(num || '').replace(/[\s-]/g, ''); return /^[2-9]\d{11}$/.test(s) && verhoeffValid(s); }
  // The official page waives Aadhaar for a residential consumer when the composed name contains one of these words (substring match, as the page does)
  var AAD_WAIVE = ["agency","apartment","appt","appartment","association","authority","bank","board","builder","builders","chairman","church","chs","c.h.s","club","college","colony","commissioner","commis","common","company","complex","condominium","commandant","construction","co op","cooperative housing","corporation","court","darga","dharamshala","developer","devstan","division","education","enclave","engineer","enterprises","estate","executive","federation","foundation","government","govt","grampanchayat","gruh","gurudwara","gymkhana","headmaster","health","height","hostel","housingsoc","institute","judge","limited","llp","ltd","magistrate","mandal","mandir","masjid","mohalla","mosque","mukhyadhyapak","mukhyaadhikari","municipal","municipal corporation","muncipal corporation","nagarpalika","nagar palika","nagarparishad","nagar parishad","officer","paying guest","pg","police","postoffice","principal","primary","private","pvtltd","pvt ltd","quarters","regency","registar","residence","residency","sahakari","sangh","sangha","sanstha","sansthan","sarpanch","school","secretary","society","superintendant","supdt","tahasildar","temple","the","township","transport","treasury","trust","trustee","university","vidyalay","wing","workshop","zillparishad"];
  function aadhaarWaived(fullName) { var n = String(fullName || '').toLowerCase(); return AAD_WAIVE.some(function (k) { return n.indexOf(k) >= 0; }); }
  // What the official page said about the Aadhaar OTP, from its own alerts: {ok, error, text}. A reply with an error word is an ERROR, never a "linked mobile".
  var AAD_BAD = /invalid|error|fail|not\s+found|no\s+mobile|incorrect|wrong|unable|please\s+(enter|try)|try\s+after|mandatory|not\s+matched/i;
  function aadhaarReply(msgs) {
    var list = (msgs || []).map(function (m) { return oneSpace(m && m.t != null ? m.t : m); }).filter(Boolean), seen = {}, uniq = [];
    list.forEach(function (x) { if (!seen[x]) { seen[x] = 1; uniq.push(x); } });
    var bad = uniq.filter(function (x) { return AAD_BAD.test(x); });
    if (bad.length) return { ok: false, error: bad.join(' ').slice(0, 300), text: uniq.join(' ').slice(0, 300) };
    return { ok: uniq.length > 0, error: '', text: uniq.join(' ').slice(0, 300) };
  }

  /* ---------- v1.1.4: final Submit result, name mismatch, login OTP destination ---------- */
  var SUB_ERR = /invalid|incorrect|wrong|expired|mismatch|not\s+(?:match|valid|allowed|eligible)|please\s+(?:enter|check|select|accept|tick|upload|correct|try|re-?enter)|mandatory|required|should\s+not|can\s*not|cannot|failed|failure|unable|error|exceed|arrears|blank|special\s+characters/i;
  var SUB_OK = /(?:received|registered|submitted|lodged)\s+successfully|successfully\s+(?:received|registered|submitted|lodged)|application\b[^.]{0,70}\bis\s+(?:received|submitted|registered|lodged)\b|acknowledg(?:e)?ment/i;
  function uniqStr(list) { var seen = {}, out = []; (list || []).forEach(function (x) { x = oneSpace(x && x.t != null ? x.t : x); if (x && !seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
  // o: {appNo, text (page text), msgs[] (site alerts), alive (the marker of the page we clicked on is still there), settledMs (how long the replaced page has been stable), elapsed}
  // -> {kind: 'ok' | 'error' | 'probably' | 'unclear' | 'wait', msg}
  function classifySubmit(o) {
    var msgs = uniqStr(o.msgs), text = clean(o.text || ''), el = o.elapsed || 0;
    if (o.appNo) return { kind: 'ok', msg: msgs[0] || '' };
    var err = msgs.filter(function (x) { return SUB_ERR.test(x); }), good = msgs.filter(function (x) { return SUB_OK.test(x); });
    if (good.length && !err.length) return { kind: 'ok', msg: good[0] };
    if (err.length) return { kind: 'error', msg: err[0] };
    if (!o.alive) {   // the page we clicked on is gone: the form was posted
      if (SUB_OK.test(text)) return { kind: 'ok', msg: (text.match(SUB_OK) || [''])[0] };
      return (o.settledMs || 0) >= 6000 ? { kind: 'probably', msg: msgs[0] || '' } : { kind: 'wait', msg: '' };
    }
    return el > 45000 ? { kind: 'unclear', msg: msgs[0] || '' } : { kind: 'wait', msg: '' };
  }
  // text kept in Diagnostics after Submit: digit runs shortened (OTPs, mobiles, application numbers never printed)
  function redactDigits(text) { return String(text == null ? '' : text).replace(/\d{4,}/g, function (m) { return '[' + m.length + ' digits]'; }); }
  var NAME_MISMATCH = /name\s+(?:does\s+)?not\s+match(?:ed)?|not\s+match(?:ed)?\s+with\s+aadh?a?r\s+registered\s+name/i;
  function aadhaarNameMismatch(msgs) { return uniqStr(Array.isArray(msgs) ? msgs : [msgs]).some(function (x) { return NAME_MISMATCH.test(x); }); }
  // "OTP has been successfully sent to following contact details. <details> Please enter the OTP ..." -> the details part, as the page words it
  function loginOtpTo(text) {
    var s = clean(text), m = s.match(/(?:sent\s+to|sent\s+on)\s+(?:the\s+)?following\s+contact\s+details\.?:?\s*(.{3,200}?)(?=\s*(?:please\s+enter|enter\s+otp|otp\s*:|login\b|$))/i);
    if (m && m[1] && !/^(please|enter)/i.test(m[1])) return m[1].trim();
    var mob = s.match(/(?:mobile(?:\s*(?:number|no\.?))?)\s*:?\s*([X*x\d]{4,})/i), em = s.match(/(?:e-?mail(?:\s*id)?)\s*:?\s*([\w.*x-]+@[\w.*-]+)/i);
    return [mob ? 'Mobile: ' + mob[1] : '', em ? 'Email: ' + em[1] : ''].filter(Boolean).join(' / ');
  }
  /* ---------- v1.1.2: consumer list search (name + number from one box) ---------- */
  function normQ(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function filterConsumers(list, q) {
    var n = normQ(q); if (!n) return (list || []).slice();
    var digits = n.replace(/\D/g, ''), onlyNum = /^[\d\s-]+$/.test(n) && digits.length > 0;
    return (list || []).filter(function (c) {
      var name = normQ(c.name), cno = String(c.cno || '');
      if (onlyNum) return cno.indexOf(digits) >= 0 || name.indexOf(n) >= 0;       // digits: the consumer number (substring)
      return name.indexOf(n) >= 0 || normQ((c.cells || []).join(' ')).indexOf(n) >= 0;   // text: the name, then the billing unit / division line
    });
  }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim()); }
  function validMobile(s) { return /^[6-9]\d{9}$/.test(String(s || '').trim()); }
  // Application number from the official page text (8 digits)
  function parseAppNo(text) {
    var s = clean(text), m = s.match(/application\s*(?:id|no\.?|number)\s*(?:is|:|-|was|generated|generated\s+is)?\s*[:\-]?\s*(\d{8})\b/i) ||
      s.match(/(?:request|application)[^0-9]{0,60}\b(\d{8})\b/i);
    return m ? m[1] : '';
  }
  // First "Rs 130" style amount near the word fee
  function feeFromText(text) {
    var s = clean(text), m = s.match(/(?:processing\s*)?fee[^0-9]{0,40}(?:rs\.?|inr|\u20B9)?\s*(\d{2,5})(?:\.\d+)?/i) || s.match(/(?:rs\.?|inr|\u20B9)\s*(\d{2,5})(?:\.\d+)?/i);
    return m ? parseInt(m[1], 10) : 0;
  }
  // Status of the payment receipt table: 'success' | 'pending' | 'failed' | ''
  function receiptStatus(pairs, text) {
    var v = '';
    (pairs || []).forEach(function (r) { if (!v && /status/i.test(r[0])) v = String(r[1] || ''); });
    if (!v) { var m = String(text || '').match(/status\s*[:\-]?\s*(success\w*|fail\w*|pending|in\s*progress|processing|awaited|initiated)/i); v = m ? m[1] : ''; }
    v = v.toLowerCase();
    return /succe/.test(v) ? 'success' : /fail|declin|reject/.test(v) ? 'failed' : v ? 'pending' : '';
  }
  // Mobile number shown by the site for an Aadhaar OTP, exactly as written (no masking, no cleaning)
  function aadhaarMobileText(text) {
    var s = String(text || '').replace(/\s+/g, ' '), m = s.match(/(?:\+?91[\s-]?)?[X*x\d]{2,}[X*x\d\s-]{4,}\d{2,}/);
    var ten = s.match(/(?:\+91[\s-]?)?[6-9]\d{9}/);
    return (ten && ten[0]) || (m && m[0].trim()) || '';
  }
  // A clean file name for the receipt files (letters, digits, _ and - only)
  function receiptName(appNo, ext) { return uploadName('Receipt_' + (appNo || 'MSEDCL') + '.' + ext, 'Receipt', ext); }

  /* ---------- v1.1.1: login page state classifier (pure; works on a page snapshot from vsdrv.js) ----------
   * snap = { url, title, text, main, msgs[], fields[{type,id,name,label,tag,ro,vis}], buttons[{t,id,nav}] }
   * Never treats navigation / menu text ("Complaint Status", "Complaint Registration" ...) as an error. */
  function normTxt(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, ''); }
  var ERR_WORDS = /invalid|incorrect|wrong|not\s*(?:valid|match|allowed|found|registered)|enter\s+(?:the\s+)?(?:captcha|login|user|password|otp|valid)|please\s+(?:enter|try|login|log\s*in|select|check)|captcha|expired|session|locked|blocked|too\s+many|failed|failure|unable|error|something\s+went\s+wrong|mismatch|attempt/i;
  function cleanErrors(msgs, buttons, trusted) {
    var nav = {};
    (buttons || []).forEach(function (b) { var k = normTxt(b && (b.t || b.text)); if (k) nav[k] = 1; });
    var out = [];
    (msgs || []).forEach(function (m) {
      var raw = String(m && m.t != null ? m.t : m == null ? '' : m).replace(/\s+/g, ' ').trim();
      if (raw.length < 4 || raw.length > 250) return;
      var k = normTxt(raw);
      if (!k || nav[k]) return;                                  // exactly a menu / button label
      for (var key in nav) { if (nav.hasOwnProperty(key) && key.length >= 6 && k.length <= key.length + 3 && k.indexOf(key) >= 0 && !ERR_WORDS.test(raw)) return; }   // (nearly) a menu label
      if (!trusted && !ERR_WORDS.test(raw)) return;              // a page element needs error words to count; plain menu text never has them
      if (out.indexOf(raw) < 0) out.push(raw);
    });
    return out;
  }
  function otpBoxes(fields) {
    return (fields || []).filter(function (f) {
      var k = (String(f.label || '') + ' ' + String(f.id || '') + ' ' + String(f.name || '')).toLowerCase();
      return f.vis !== false && /otp/.test(k) && !/aadhaar|aadhar|aad|captcha/.test(k) && f.type !== 'checkbox' && f.type !== 'radio' && f.tag === 'input' && !f.ro;
    });
  }
  var SITE_ERR_RES = [/enter captcha first/i, /invalid[\s_]*captcha/i, /invalid (?:login|user)[^.\n]{0,50}/i, /(?:login|user)[a-z ]{0,12}(?:or password )?(?:is |are )?(?:incorrect|invalid|wrong)[^.\n]{0,30}/i, /single quote\/double quote is not allowed[^.\n]{0,30}/i, /error while sending otp[^.\n]{0,30}/i, /entered otp must be 7 digits only/i, /you have entered wrong otp/i, /please enter otp/i, /invalid otp/i];
  // returns {kind: accounts|home|loginotp|login|form|upload|other|none, signals[], errors[]}
  function classifyLoginPage(snap, consumers, step) {
    if (!snap) return { kind: 'none', signals: [], errors: [] };
    var fields = snap.fields || [], buttons = snap.buttons || [], sig = [];
    var title = String(snap.title || ''), url = String(snap.url || ''), low = String(snap.main != null && snap.main !== '' ? snap.main : snap.text || '').toLowerCase();
    var pass = fields.some(function (f) { return f.type === 'password' && f.vis !== false; });
    var user = fields.some(function (f) { return f.vis !== false && f.type !== 'password' && /loginid|login\s*name|user\s*name|username/i.test(String(f.id || '') + ' ' + String(f.label || '')) && !/otp/i.test(String(f.id || '')); });
    var otps = otpBoxes(fields);
    var cons = (consumers && consumers.length) || 0;
    var errors = cleanErrors(snap.msgs, buttons);
    var btnsNonNav = buttons.filter(function (b) { return !b.nav; });
    var logout = btnsNonNav.concat(buttons.filter(function (b) { return b.nav; })).some(function (b) { return /^(logout|log out|sign out)$/i.test(String(b.t || '').trim()); }) || /(^|\s)(logout|log out|sign out)(\s|$)/i.test(low);
    if (cons) sig.push('consumer list (' + cons + ')');
    if (otps.length) sig.push('OTP box visible');
    if (pass) sig.push('password field visible'); if (user) sig.push('login name field visible');
    if (logout) sig.push('Logout visible');
    if (/getmyaccount/i.test(url)) sig.push('My Account url');
    if (/manage my account|my account/i.test(title)) sig.push('My Account title');
    if (/खाते व्यवस्थापन/.test(title)) sig.push('My Account title (Marathi)');
    var kind = 'other';
    if (cons) kind = 'accounts';
    else if (fields.some(function (f) { return f.tag === 'input' && /first\s*name|firstname/i.test(String(f.label || '') + String(f.id || '') + String(f.name || '')); }) && fields.some(function (f) { return f.tag === 'select' && /reason|purpose/i.test(String(f.label || '') + String(f.id || '') + String(f.name || '') + JSON.stringify(f.options || [])); })) kind = 'form';
    else if (fields.some(function (f) { return f.type === 'file'; })) kind = 'upload';
    else if (otps.length && (pass || user) && step !== 'confirm') kind = 'loginotp';
    else if (otps.length && /login|sign in/i.test(low) && step !== 'confirm') kind = 'loginotp';
    else if (pass || user) kind = 'login';
    else if (logout || /getmyaccount/i.test(url) || /manage my account/i.test(title) || /खाते व्यवस्थापन/.test(title)) kind = 'home';
    if (kind === 'login' || kind === 'loginotp') {   // the site's own validation strings (from its login page script), wherever it prints them
      var body = String(snap.main || '') + ' ' + String(snap.text || '').slice(0, 4000);
      SITE_ERR_RES.forEach(function (re) { var mt = body.match(re); if (mt) { var x = mt[0].replace(/\s+/g, ' ').trim(); if (errors.indexOf(x) < 0 && !errors.some(function (e) { return e.toLowerCase().indexOf(x.toLowerCase()) >= 0; })) { errors.push(x); sig.push('site message: ' + x); } } });
    }
    return { kind: kind, signals: sig, errors: errors };
  }

  return {
    STATUS_URL: STATUS_URL, BILL_HEADERS: BILL_HEADERS, clean: clean, decodeEntities: decodeEntities,
    validConsumerNo: validConsumerNo, validAppId: validAppId, classifyStatus: classifyStatus,
    parseStatusPage: parseStatusPage, statusUrl: statusUrl, aspFormFields: aspFormFields, uploadButton: uploadButton,
    billUrl: billUrl, parseBill: parseBill, yymmLabel: yymmLabel, prevMonths: prevMonths,
    findApplicationId: findApplicationId, safeFileName: safeFileName, uploadName: uploadName, docSlots: docSlots, docName: docName, guessSlot: guessSlot, fillTemplate: fillTemplate,
    parseMsedclDate: parseMsedclDate, versionNewer: versionNewer,
    NAME_MAX: NAME_MAX, isMS: isMS, upName: upName, verhoeffValid: verhoeffValid, validAadhaar: validAadhaar, aadhaarWaived: aadhaarWaived, aadhaarReply: aadhaarReply, filterConsumers: filterConsumers, composeName: composeName, nameLength: nameLength, clampName: clampName, validEmail: validEmail, validMobile: validMobile,
    parseAppNo: parseAppNo, feeFromText: feeFromText, receiptStatus: receiptStatus, aadhaarMobileText: aadhaarMobileText, receiptName: receiptName,
    cleanErrors: cleanErrors, otpBoxes: otpBoxes, classifyLoginPage: classifyLoginPage,
    classifySubmit: classifySubmit, redactDigits: redactDigits, aadhaarNameMismatch: aadhaarNameMismatch, loginOtpTo: loginOtpTo
  };
});
