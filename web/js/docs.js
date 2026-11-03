/* VidyutSewa By Yuvraj - on-device document compression (images and PDFs -> one PDF under the size limit).
 * Everything happens locally in the app; no file ever leaves the device here. */
(function () {
  'use strict';
  var LIMIT = 300 * 1024;           // MSEDCL upload limit
  var TARGET = 292 * 1024;          // keep a margin under the limit
  var DIMS = { high: [2200, 1900, 1600, 1400, 1200, 1000, 850, 700, 600],
               balanced: [1700, 1450, 1250, 1050, 900, 760, 640, 560],
               small: [1250, 1050, 900, 760, 640, 540, 460] };
  var QUAL = [0.82, 0.72, 0.62, 0.54, 0.46, 0.38, 0.32];

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
  // compress a list of drawable sources so the total fits the budget
  async function fitPages(sources, quality) {
    var dims = DIMS[quality] || DIMS.balanced;
    var per = (TARGET - 1500 - sources.length * 600) / sources.length;
    var pages = [];
    for (var i = 0; i < sources.length; i++) {
      var s = sources[i], best = null;
      outer: for (var d = 0; d < dims.length; d++) {
        for (var k = 0; k < QUAL.length; k++) {
          var r = await toJpeg(s.el, s.w, s.h, dims[d], QUAL[k]);
          best = r;
          if (r.bytes.length <= per) break outer;
          if (k >= 3) break; // drop resolution before quality gets ugly
        }
      }
      pages.push(best);
    }
    return pages;
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
        push('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>\nstream\n');
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

  /* Public: turn any picked file into ONE upload-ready PDF under 300 KB (compressed once). */
  async function process(file, opts) {
    opts = opts || {};
    var bytes = await readBytes(file), origSize = bytes.length;
    var pdf = isPdf(bytes) || /pdf/i.test(file.type || '') || /\.pdf$/i.test(file.name || '');
    if (pdf && bytes.length <= LIMIT) return { bytes: bytes, origSize: origSize, size: bytes.length, compressed: false, pages: null };
    var sources, pagesTotal = 1;
    if (pdf) {
      var r = await renderPdfPages(bytes, 12, (DIMS[opts.quality] || DIMS.balanced)[0]);
      sources = r.pages; pagesTotal = r.total;
    } else {
      var img = await loadImage(file);
      sources = [{ el: img, w: img.naturalWidth, h: img.naturalHeight }];
    }
    var pages = await fitPages(sources, opts.quality);
    var out = buildPdf(pages);
    if (out.length > LIMIT) {
      pages = await fitPages(sources, 'small');
      out = buildPdf(pages);
    }
    if (out.length > LIMIT) throw new Error('Could Not Compress Below 300 KB. Try A Clearer Scan With Fewer Pages.');
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

  window.VSDocs = { LIMIT: LIMIT, process: process, thumb: thumb, renderAll: renderAll, buildPdf: buildPdf,
    b64FromBytes: b64FromBytes, bytesFromB64: bytesFromB64, fmtSize: fmtSize, readBytes: readBytes, isPdf: isPdf };
})();
