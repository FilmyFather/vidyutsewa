
# Headless check of: (1) the 1 MB compression rule, (2) clean file names, (3) Spelling Correction mode.
# Usage: python tools/ui_spell_compress.py <base_url> <out_dir> <samples_dir>
import sys, os, json, asyncio, glob, base64, hashlib
from playwright.async_api import async_playwright
BASE, OUT, SAMP = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__)); FX = os.path.join(HERE, '..', 'tests', 'fixtures')
EXE = (glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')) or [None])[0]
os.makedirs(OUT, exist_ok=True)
errors, results = [], []
def check(name, ok, info=''):
    results.append((name, bool(ok), info)); print(('PASS ' if ok else 'FAIL ') + name + ('  ' + str(info) if info else ''))
PROC_JS = '''async ([name, b64]) => {
  const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const type = name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const t0 = performance.now();
  const r = await VSDocs.process(new File([u], name, { type }), {});
  const out = r.bytes; let s = '', CH = 0x8000; for (let i = 0; i < out.length; i += CH) s += String.fromCharCode.apply(null, out.subarray(i, i + CH));
  return { size: r.size, orig: r.origSize, compressed: r.compressed, wrapped: !!r.wrapped, pages: r.pages, ms: Math.round(performance.now() - t0), b64: btoa(s) };
}'''
DEADLINE_JS = '''() => { const a = VS.state.apps[0]; const mk = (mode, n) => ({ status: 'pending', docMode: mode, docsUploaded: n, appliedAt: Date.now() });
  return { spell1: VS.deadline(mk('spell', 1)), spell0: !!VS.deadline(mk('spell', 0)), normal1: !!VS.deadline(mk('normal', 1)), normal2: VS.deadline(mk('normal', 2)), hasDocsSpell: VS.hasDocs(a), hasDocsNormalSame: VS.hasDocs(Object.assign({}, a, { docMode: 'normal' })) } }'''
SAVE_DIS = "document.querySelector('button.btn.pri[onclick=\"UI.saveOld()\"]').disabled"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        async def status_route(route):
            await route.fulfill(status=200, content_type='text/html', body=open(os.path.join(FX, 'status-submitted.html'), encoding='utf-8').read())
        await page.route('https://css.mahadiscom.in/**', status_route)
        await page.goto(BASE + '/index.html'); await page.wait_for_timeout(2800)
        await page.fill('#m-shop', 'Yuvi Online Services'); await page.click('text=Continue')

        async def run(fname):
            data = open(os.path.join(SAMP, fname), 'rb').read()
            r = await page.evaluate(PROC_JS, [fname, base64.b64encode(data).decode()])
            return data, r, base64.b64decode(r['b64'])
        d, r, o = await run('s600.pdf')
        check('600 KB PDF: bytes untouched (identical sha256)', hashlib.sha256(d).digest() == hashlib.sha256(o).digest() and not r['compressed'], f"{len(d)} -> {len(o)}")
        d, r, o = await run('s600.jpg')
        check('600 KB JPEG: picture bytes untouched inside the PDF page (not recompressed)', (d in o) and not r['compressed'], f"{len(d)} -> pdf {len(o)}")
        d, r, o = await run('s-small.png')
        check('small PNG: converted (site takes only jpg/pdf), valid PDF under 1 MB', o[:4] == b'%PDF' and len(o) <= 1048576, f"{len(d)} -> {len(o)}")
        for fn in ('s3m.pdf', 's3m.jpg', 's3m-2pages.pdf'):
            d, r, o = await run(fn)
            check(f'{fn}: over 1 MB -> gently compressed to just under 1 MB (not 300 KB)', r['compressed'] and 850000 <= len(o) <= 1000000 and o[:4] == b'%PDF', f"{len(d)} -> {len(o)} bytes, pages={r['pages']}, {r['ms']} ms")
            open(os.path.join(OUT, 'out_' + os.path.splitext(fn)[0] + '.pdf'), 'wb').write(o)

        await page.click('text=Add Old Application')
        await page.fill('#ao-id', '12345678'); await page.click('#ao-v'); await page.wait_for_timeout(800)
        txt = await page.inner_text('body')
        check('Add Old: both choices visible', 'Spelling Correction - 1 PDF' in txt and 'Normal - Agreement + Form X' in txt)
        await page.screenshot(path=os.path.join(OUT, 'a1-addold-normal.png'))
        async with page.expect_file_chooser() as fc:
            await page.click('text=Files >> nth=0')
        await (await fc.value).set_files([os.path.join(SAMP, 's600.pdf')]); await page.wait_for_timeout(1200)
        check('Normal mode: Save stays disabled with only one PDF', await page.evaluate(SAVE_DIS))
        check('Normal mode: shows TWO slots', await page.evaluate("document.querySelectorAll('.slot').length") == 2)
        await page.click('#mode-seg >> text=Spelling Correction - 1 PDF'); await page.wait_for_timeout(500)
        txt = await page.inner_text('body')
        nslots = await page.evaluate("document.querySelectorAll('.slot').length")
        check('Spelling mode: ONE slot (Correction PDF); no second slot, no Pick Both', nslots == 1 and 'Correction PDF' in txt and 'Pick Both' not in txt, f'slots={nslots}')
        check('Spelling mode: Save disabled until the one PDF is attached', await page.evaluate(SAVE_DIS))
        async with page.expect_file_chooser() as fc:
            await page.click('text=Files >> nth=0')
        await (await fc.value).set_files([os.path.join(SAMP, 's3m.jpg')]); await page.wait_for_timeout(4500)
        await page.screenshot(path=os.path.join(OUT, 'a2-addold-spelling-ready.png'))
        check('Spelling mode: Save enabled with exactly one PDF', not await page.evaluate(SAVE_DIS))
        await page.click('text=Save Application'); await page.wait_for_timeout(1200)
        a = json.loads(await page.evaluate('JSON.stringify(VS.state.apps[0])'))
        check('stored per application: docMode=spell, only the single slot saved', a.get('docMode') == 'spell' and list(a['docs'].keys()) == ['single'], json.dumps(a['docs']))
        check('saved file name is clean', a['docs']['single']['name'] == 'SpellingCorrection_12345678.pdf', a['docs']['single']['name'])
        txt = await page.inner_text('body')
        check('Detail: type + exactly 1 saved PDF row', 'Spelling Correction - 1 PDF' in txt and 'SpellingCorrection_12345678.pdf' in txt and 'FormX_' not in txt)
        await page.screenshot(path=os.path.join(OUT, 'a3-detail-spelling.png'))
        r = await page.evaluate(DEADLINE_JS)
        check('3-day deadline: spelling stops at 1 uploaded; normal needs 2', r['spell1'] is None and r['spell0'] and r['normal1'] and r['normal2'] is None, json.dumps(r))
        check('hasDocs respects the mode', r['hasDocsSpell'] and not r['hasDocsNormalSame'])
        await page.evaluate("window.__shares = []; const o = Native.call; Native.call = function (m, a) { if (m === 'share') { window.__shares.push(a.text); return Promise.resolve({}); } return o.apply(this, arguments); }")
        await page.evaluate("UI.shareApp('12345678')"); await page.wait_for_timeout(300)
        sh = await page.evaluate('window.__shares[0]')
        check('share text names the application type', 'Application Type: Spelling Correction In Name' in sh, sh.replace('\n', ' | '))
        await page.click('text=Re-Upload >> nth=0'); await page.wait_for_timeout(300)
        txt = await page.inner_text('body')
        check('Re-Upload sheet: Correction PDF only', 'Saved Correction PDF' in txt and 'Agreement And Form X' not in txt)
        await page.screenshot(path=os.path.join(OUT, 'a5-reupload-sheet.png'))
        await page.evaluate('UI.closeSheet()')
        await page.click('.hdr .iconbtn'); await page.click('nav >> text=Documents'); await page.wait_for_timeout(500)
        txt = await page.inner_text('body')
        check('Vault: one PDF row for the spelling application', 'SpellingCorrection_12345678.pdf' in txt and 'FormX_' not in txt)
        await page.screenshot(path=os.path.join(OUT, 'a4-vault.png'))
        await page.click('nav >> text=Home'); await page.wait_for_timeout(300)
        await page.click('text=New Application'); await page.wait_for_timeout(400)
        txt = await page.inner_text('body')
        check('New Application step 1: type choice shown', 'Spelling Correction - 1 PDF' in txt and 'Normal - Agreement + Form X' in txt)
        await page.screenshot(path=os.path.join(OUT, 'a6-newapp-choice.png'))
        check('footer present', 'Designed & Developed By' in txt and 'Yuvraj Chauhan' in txt)
        await b.close()
asyncio.run(main())
print('ERRORS', json.dumps(errors, indent=1))
bad = [r for r in results if not r[1]]
print('SUMMARY', len(results) - len(bad), 'passed,', len(bad), 'failed')
sys.exit(1 if bad or errors else 0)
