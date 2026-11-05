#!/usr/bin/env python3
"""Driver check against the REAL (public, saved) wss login page: which button does the app's click spec pick, and what does the error scan see?
Usage: python3 tests/e2e/driver_real_login.py <project dir>   (needs playwright + chromium; nothing is sent anywhere, the page is a local copy)"""
import sys, re, json, asyncio, glob, os
from playwright.async_api import async_playwright
W = sys.argv[1]
EXE = (glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')) or [None])[0]
src = open(W + '/web/js/newapp.js').read()
def spec(name):
    m = re.search(r'^\s*' + name + r': (\{.*\}),?\s*(//.*)?$', src, re.M); return m.group(1)
html = open(W + '/tests/fixtures/wss-login-real.html', encoding='utf-8').read()
html = re.sub(r'<script[^>]+src=[^>]*></script>', '', html)
DRV = open(W + '/web/js/vsdrv.js').read()
res = []
def ok(n, c, x=''): res.append(c); print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' | ' + str(x)))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE, args=['--no-sandbox']); pg = await b.new_page()
        await pg.route('**/*', lambda r: r.abort() if not r.request.url.startswith(('data:', 'about:')) else r.continue_())
        await pg.set_content(html, wait_until='domcontentloaded'); await pg.evaluate(DRV)
        h = await pg.evaluate('__vsd.hasButton(' + spec('loginBtn') + ')')
        ok('Login step clicks #loginButton (Generate OTP), not the left-menu Login link', h.get('ok') and h.get('id') == 'loginButton', h)
        s = await pg.evaluate('__vsd.snap()')
        ok('left-menu items are flagged as navigation', all(x['nav'] for x in s['buttons'] if x['id'] == 'leftnav_loginPage' or x['t'] == 'Complaint Status') and any(x['id'] == 'leftnav_loginPage' for x in s['buttons']), [x for x in s['buttons'] if 'Login' in x['t']])
        ok('error scan does not report "Complaint Status" (or any menu text)', not any(re.search('complaint|registration|swagat|status', m, re.I) for m in s['msgs']), s['msgs'])
        ok('snapshot carries title, url and main-content text without the menu', s['main'] is not None and 'Complaint Status' not in s['main'], s['main'][:120])
        c = await pg.evaluate('__vsd.captcha()')
        ok('captcha canvas still readable (100x40)', c.get('ok') and c.get('w') == 100 and c.get('h') == 40, {k: c.get(k) for k in ('ok', 'w', 'h', 'err')})
        await b.close()
asyncio.run(main()); print('RESULT %d/%d' % (sum(res), len(res))); sys.exit(0 if all(res) else 1)
