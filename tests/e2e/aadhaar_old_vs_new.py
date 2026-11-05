"""Proof for the v1.1.1 Aadhaar failure: the OLD driver (tests/fixtures/vsdrv-v111.js) sets the whole 12-digit value at once, so the official page's own script
(which masks the box and rebuilds the real number from ONE keystroke at a time) ends up holding a single digit and the mock answers exactly what Yuvi saw:
"Invalid Aadhar Number entered. Invalid Auth XML format."  The NEW driver types key by key and the page holds all 12 digits.
Run: start `python3 tests/mock/server.py 8098 resident`, then `python3 tests/e2e/aadhaar_old_vs_new.py <project dir>`.  Uses a dummy number only."""
import asyncio, glob, os, sys, json
from playwright.async_api import async_playwright
EXE = (glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')) or [None])[0]
P = sys.argv[1]
OLD = open(P + '/tests/fixtures/vsdrv-v111.js').read(); NEW = open(P + '/web/js/vsdrv.js').read()
NUM = '234567890124'   # dummy, valid check digit
res = []
def ok(n, c, x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + ('' if c else ' | ' + str(x)))
async def run(label, drv, fill_js):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE, args=['--no-sandbox']); pg = await b.new_page()
        await pg.goto('http://127.0.0.1:8098/wss/__form'); await pg.evaluate(drv)
        await pg.evaluate("txtConsumerFirstName.value='Jai';txtConsumerLastName.value='Patil'")
        await pg.evaluate("__vsd.fill({any:['aadhaar consent','consent'],type:'checkbox'}, true)")
        await pg.evaluate(fill_js)
        hdn = await pg.evaluate("document.getElementById('hdnAadharNum').value.length")
        await pg.evaluate("__vsd.click({ids:['btnUIDAIGenerateOTP'],any:['generate otp'],after:{any:['aadhaar number'],tag:'input'}})")
        await pg.wait_for_timeout(900)
        msgs = await pg.evaluate("__vsd.drain().msgs.map(m=>m.t)")
        mob = await pg.evaluate("document.getElementById('txtAadharMobNo').value")
        await b.close(); return hdn, msgs, mob
async def main():
    hdn, msgs, mob = await run('old', OLD, "__vsd.fill({any:['aadhaar number','aadhar number','aadhaar','aadhar'],tag:'input',notType:['checkbox','radio','file','button','submit'],editable:true}, '%s')" % NUM)
    ok('OLD driver: the official page holds only 1 digit', hdn == 1, hdn)
    ok('OLD driver: the official page answers exactly what Yuvi saw', msgs == ['Invalid Aadhar Number entered.', 'Invalid Auth XML format.'], msgs)
    ok('OLD driver: no linked mobile', mob == '', mob)
    hdn, msgs, mob = await run('new', NEW, "__vsd.fillAadhaar('%s')" % NUM)
    ok('NEW driver: the official page holds all 12 digits', hdn == 12, hdn)
    ok('NEW driver: OTP sent, no error words', len(msgs) == 1 and msgs[0].startswith('OTP sent'), msgs)
    ok('NEW driver: the official page filled the linked mobile', mob == '9876543210', mob)
    print('RESULT %d/%d' % (sum(res), len(res)))
    sys.exit(0 if all(res) else 1)
asyncio.run(main())
