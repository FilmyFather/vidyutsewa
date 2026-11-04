/* VidyutSewa By Yuvraj - on-device document compression (images and PDFs -> one PDF under the size limit).
 * Everything happens locally in the app; no file ever leaves the device here. */
(function () {
  'use strict';
  var LIMIT = 1048576;              // MSEDCL upload page: "Only files upto 1MB are allowed". Up to this size a file is never touched.
  var TARGET = 1000000;             // bigger files are compressed to just under this (a little below 1 MB either way you count it)
  var MIN_Q = 0.5, GOOD_Q = 0.72;   // JPEG quality range for the gentle search (never below MIN_Q)

  function pdfjs() {
    var lib = window.pdfjsLib;
    if (lib && !lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = 'lib/pdfjs/pdf.worker.min.js';
    return lib;
  }
  function readBytes(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(new Uint8Array(fr.result)); };
      fr.onerror = function () { rej(fr.error || new Error('Could Not Read File')); };
      fr.readAsArrayBuffer(blob);
    });
  }
  function isPdf(bytes) { return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; }
  function loadImage(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { res(img); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('This Image Format Is Not Supported. Please Use JPG, PNG Or PDF.')); };
      img.src = url;
    });
  }
  function toJpeg(source, sw, sh, maxDim, q) {
    var scale = Math.min(1, maxDim / Math.max(sw, sh));
    var w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return new Promise(function (res) {
      c.toBlob(function (b) { readBytes(b).then(function (bytes) { res({ bytes: bytes, w: w, h: h }); }); }, 'image/jpeg', q);
    });
  }
  // Gentle compression: keep the highest resolution that still allows a good quality, then use the best quality that fits.
  async function fitPage(src, per) {
    var longest = Math.max(src.w, src.h), dim = Math.min(longest, 3200), fallback = null;
    for (var step = 0; step < 14; step++) {
      var lo = MIN_Q, hi = 0.95, hit = null, r = await toJpeg(src.el, src.w, src.h, dim, hi);
      if (r.bytes.length <= per) hit = { r: r, q: hi };
      else {
        var rl = await toJpeg(src.el, src.w, src.h, dim, lo);
        if (rl.bytes.length <= per) {
          hit = { r: rl, q: lo };
          for (var i = 0; i < 5; i++) {
            var mid = (lo + hi) / 2, rm = await toJpeg(src.el, src.w, src.h, dim, mid);
            if (rm.bytes.length <= per) { lo = mid; hit = { r: rm, q: mid }; } else hi = mid;
          }
        }
      }
      if (hit) { fallback = hit.r; if (hit.q >= GOOD_Q) return hit.r; }
      dim = Math.round(dim * 0.88);
      if (dim < 500) break;
    }
    return fallback || await toJpeg(src.el, src.w, src.h, 500, 0.4);
  }
  async function fitPages(sources, factor) {
    var per = (TARGET * (factor || 1) - 1500 - sources.length * 600) / sources.length, pages = [];
    for (var i = 0; i < sources.length; i++) pages.push(await fitPage(sources[i], per));
    return pages;
  }

  /* ---- JPEG facts (size, colour channels, rotation flag) so an untouched JPEG can be wrapped into a PDF as it is ---- */
  function jpegInfo(b) {
    if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
    var i = 2, orient = 1, info = null;
    while (i + 4 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      var m = b[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
      var len = (b[i + 2] << 8) | b[i + 3];
      if (m === 0xE1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {   // "Exif"
        var t = i + 10, le = b[t] === 0x49;
        var u16 = function (o) { return le ? (b[t + o] | (b[t + o + 1] << 8)) : ((b[t + o] << 8) | b[t + o + 1]); };
        var u32 = function (o) { return le ? (b[t + o] | (b[t + o + 1] << 8) | (b[t + o + 2] << 16) | (b[t + o + 3] << 24)) : ((b[t + o] << 24) | (b[t + o + 1] << 16) | (b[t + o + 2] << 8) | b[t + o + 3]); };
        try {
          var ifd = u32(4), n = u16(ifd);
          for (var k = 0; k < n; k++) { var e = ifd + 2 + k * 12; if (u16(e) === 0x0112) { orient = u16(e + 8); break; } }
        } catch (err) {}
      }
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        info = { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], comps: b[i + 9], progressive: m === 0xC2, baseline: m === 0xC0 || m === 0xC1 };
        break;
      }
      i += 2 + len;
    }
    if (info) info.orient = orient;
    return info;
  }

  /* ---- minimal PDF writer: one JPEG per page (DCTDecode) ---- */
  function buildPdf(pages) {
    var enc = new TextEncoder(), chunks = [], offs = [], len = 0;
    function push(x) { var b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; }
    function obj(n, body) { offs[n] = len; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); }
    var n = pages.length, kids = [];
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    push('%PDF-1.4\n');
    push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    obj(1, function () { push('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { push('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>'); });
    pages.forEach(function (p, i) {
      var pn = 3 + i * 3, cn = pn + 1, im = pn + 2;
      var W = 595.28, H = Math.round(W * p.h / p.w * 100) / 100;
      var content = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q';
      obj(pn, function () { push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + cn + ' 0 R >>'); });
      obj(cn, function () { push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
      obj(im, function () {
        push('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /' + (p.gray ? 'DeviceGray' : 'DeviceRGB') + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>\nstream\n');
        push(p.bytes); push('\nendstream');
      });
    });
    var total = 3 + n * 3, xref = len;
    push('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (var j = 1; j < total; j++) push(('0000000000' + offs[j]).slice(-10) + ' 00000 n \n');
    push('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    var out = new Uint8Array(len), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  }

  async function renderPdfPages(bytes, maxPages, scaleTo) {
    var lib = pdfjs(); if (!lib) throw new Error('PDF Engine Not Loaded');
    var doc = await lib.getDocument({ data: bytes.slice(0) }).promise;
    var count = Math.min(doc.numPages, maxPages || 12), out = [];
    for (var i = 1; i <= count; i++) {
      var page = await doc.getPage(i);
      var v1 = page.getViewport({ scale: 1 });
      var scale = (scaleTo || 2000) / Math.max(v1.width, v1.height);
      var vp = page.getViewport({ scale: scale });
      var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push({ el: c, w: c.width, h: c.height });
    }
    return { pages: out, total: doc.numPages };
  }

  /* Public: turn any picked file into ONE upload-ready PDF.
   * - A PDF up to 1 MB is returned byte for byte (not touched).
   * - A JPEG up to 1 MB is put into a PDF page as it is (its picture bytes are not re-encoded).
   * - Only a file over 1 MB is compressed, as gently as possible, to just under 1 MB. */
  async function process(file, opts) {
    opts = opts || {};
    var bytes = await readBytes(file), origSize = bytes.length;
    var pdf = isPdf(bytes) || /pdf/i.test(file.type || '') || /\.pdf$/i.test(file.name || '');
    if (pdf && bytes.length <= LIMIT) return { bytes: bytes, origSize: origSize, size: bytes.length, compressed: false, pages: null };
    if (!pdf && bytes.length <= LIMIT) {
      var ji = jpegInfo(bytes);
      if (ji && ji.baseline && (ji.comps === 1 || ji.comps === 3) && ji.orient === 1 && ji.w > 0 && ji.h > 0) {
        var wrapped = buildPdf([{ bytes: bytes, w: ji.w, h: ji.h, gray: ji.comps === 1 }]);
        if (wrapped.length <= LIMIT) return { bytes: wrapped, origSize: origSize, size: wrapped.length, compressed: false, wrapped: true, pages: 1 };
      }
    }
    var sources, pagesTotal = 1;
    if (pdf) {
      var r = await renderPdfPages(bytes, 20, 2480);
      sources = r.pages; pagesTotal = r.total;
    } else {
      var img = await loadImage(file);
      sources = [{ el: img, w: img.naturalWidth, h: img.naturalHeight }];
    }
    var pages = await fitPages(sources);
    var out = buildPdf(pages);
    if (out.length > TARGET + 20000) {
      pages = await fitPages(sources, 0.93);
      out = buildPdf(pages);
    }
    if (out.length > LIMIT) throw new Error('Could Not Compress Below 1 MB. Try A Clearer Scan With Fewer Pages.');
    return { bytes: out, origSize: origSize, size: out.length, compressed: true, pages: pages.length, skipped: pagesTotal - pages.length };
  }

  async function thumb(bytes, maxW) {
    try {
      var r = await renderPdfPages(bytes, 1, maxW || 360);
      return r.pages[0] ? r.pages[0].el.toDataURL('image/jpeg', 0.7) : '';
    } catch (e) { return ''; }
  }
  async function renderAll(bytes, maxW) {
    var r = await renderPdfPages(bytes, 20, maxW || 1200);
    return r.pages.map(function (p) { return p.el; });
  }

  function b64FromBytes(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function bytesFromB64(b64) {
    var s = atob(b64), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function fmtSize(n) {
    if (n == null) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  window.VSDocs = { LIMIT: LIMIT, TARGET: TARGET, jpegInfo: jpegInfo, process: process, thumb: thumb, renderAll: renderAll, buildPdf: buildPdf,
    b64FromBytes: b64FromBytes, bytesFromB64: bytesFromB64, fmtSize: fmtSize, readBytes: readBytes, isPdf: isPdf };
})();
