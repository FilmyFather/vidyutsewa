# UI smoke test in headless Chromium (browser fallback bridge). Network to MSEDCL is mocked with test fixtures.
# Usage: python tools/ui_smoke.py <base_url> <out_dir>
import sys, os, json, asyncio, glob
from playwright.async_api import async_playwright
BASE, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
FX = os.path.join(HERE, '..', 'tests', 'fixtures')
EXE = (glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')) or [None])[0]
os.makedirs(OUT, exist_ok=True)
errors = []

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=EXE, args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 400, 'height': 860}, device_scale_factor=2.5)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        async def status_route(route):
            await route.fulfill(status=200, content_type='text/html', body=open(os.path.join(FX, 'status-submitted.html'), encoding='utf-8').read())
        async def bill_route(route):
            await route.fulfill(status=200, content_type='application/json', body=open(os.path.join(FX, 'bill-recent.json')).read(), headers={'Access-Control-Allow-Origin': '*'})
        await page.route('https://css.mahadiscom.in/**', status_route)
        await page.route('https://mobileapp.mahadiscom.in/**', bill_route)
        async def shot(name):
            await page.wait_for_timeout(350)
            await page.screenshot(path=os.path.join(OUT, name + '.png'))
        await page.goto(BASE + '/index.html')
        await page.wait_for_timeout(400)
        await shot('00-splash')
        await page.wait_for_timeout(2200)
        await shot('01-mode')
        await page.fill('#m-shop', 'Yuvi Online Services')
        await page.click('text=Continue')
        await shot('02-home-empty')
        # Bill
        await page.click('nav >> text=Bill')
        await page.fill('#b-cno', '001122334455')
        await page.click('#b-go')
        await page.wait_for_timeout(600)
        await shot('03-bill')
        # Add old application
        await page.click('nav >> text=Home')
        await page.click('text=Add Old Application')
        await page.fill('#ao-id', '12345678')
        await page.click('#ao-v')
        await page.wait_for_timeout(700)
        await shot('04-addold-verified')
        # attach docs via file chooser (pick both)
        pdf = os.path.join(OUT, '_Agreement.pdf'); img = os.path.join(OUT, '_Xform.jpg')
        async with page.expect_file_chooser() as fc:
            await page.click('text=Pick Both Files')
        chooser = await fc.value
        await chooser.set_files([pdf, img])
        await page.wait_for_timeout(5000)
        await shot('05-addold-docs')
        await page.click('text=Save Application')
        await page.wait_for_timeout(900)
        await shot('06-detail')
        await page.click('.hdr .iconbtn')  # back
        await page.click('nav >> text=Applications')
        await shot('07-apps')
        await page.click('nav >> text=Documents')
        await shot('08-docs')
        await page.click('.iconbtn.gear')
        await shot('09-settings')
        await page.click('text=Sunset Power')
        await page.click('.seg >> text=Light')
        await shot('10-settings-sunset-light')
        await page.click('.hdr .iconbtn')
        await page.click('nav >> text=Home')
        await shot('11-home-sunset-light')
        # New application flow
        await page.click('text=New Application')
        await page.fill('#na-name', 'Sunil Deshmukh'); await page.fill('#na-cno', '001122334455')
        await page.click('text=Next: Documents')
        await shot('12-newapp-docs')
        state = await page.evaluate('JSON.stringify(VS.state.apps.map(a=>({id:a.id,docs:a.docs,status:a.status,newName:a.newName})))')
        print('STATE', state)
        await b.close()

asyncio.run(main())
print('ERRORS', json.dumps(errors, indent=1))
