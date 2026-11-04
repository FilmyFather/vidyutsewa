# Drives the real Electron app (desktop/) over CDP: real bridge, real network for 1 status page + 1 bill + 1 PDF.
import sys, os, asyncio, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]; FILES = sys.argv[2:]
errors = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.connect_over_cdp('http://127.0.0.1:9333')
        page = b.contexts[0].pages[0]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        async def shot(n): await page.wait_for_timeout(400); await page.screenshot(path=os.path.join(OUT, n + '.png'))
        await page.wait_for_timeout(2500)
        await shot('d01-mode')
        await page.fill('#m-shop', 'Yuvi Online Services'); await page.click('text=Continue')
        await shot('d02-home')
        await page.click('.iconbtn.gear'); await page.click('.seg >> text=Hindi'.replace('Hindi','\u0939\u093f\u0902\u0926\u0940'))
        await shot('d03-settings-hindi')
        await page.click('.seg >> text=English')
        await page.click('.hdr .iconbtn')
        # real status verify
        await page.click('text=Add Old Application'); await page.fill('#ao-id', '87261272'); await page.click('#ao-v')
        await page.wait_for_selector('.card.glow', timeout=40000)
        await shot('d04-verified-real')
        verified = await page.evaluate("UI.old && UI.old.ver ? {id:UI.old.ver.applicationId, status:UI.old.ver.rawStatus, docs:UI.old.ver.docsUploaded, fee:UI.old.ver.fee, hasName: !!UI.old.ver.newName} : null")
        print('VERIFIED', json.dumps(verified))
        async with page.expect_file_chooser() as fc:
            await page.click('text=Pick Both Files')
        await (await fc.value).set_files(FILES)
        await page.wait_for_timeout(6000)
        await shot('d05-docs')
        await page.click('text=Save Application'); await page.wait_for_timeout(1500)
        saved = await page.evaluate("Native.call('readDoc',{id:'87261272',slot:'formx'}).then(d=>d?{name:d.name,len:d.b64.length}:null)")
        print('SAVED_DOC', json.dumps(saved))
        # backup export via real bridge
        await page.click('.hdr .iconbtn')
        await page.click('.iconbtn.gear'); await page.click('text=Export Backup'); await page.wait_for_timeout(2500)
        await shot('d06-settings-backup')
        await page.click('.hdr .iconbtn')
        # real bill
        await page.click('nav >> text=Bill'); await page.fill('#b-cno', verified and '002233826874' or '000000000000'); await page.click('#b-go')
        await page.wait_for_timeout(6000)
        bill = await page.evaluate("UI.bill ? {ok:UI.bill.ok, month:UI.bill.billMonthLabel, hasPdf: !!UI.bill.pdfUrl, err: UI.bill.error||''} : null")
        print('BILL', json.dumps(bill))
        if bill and bill['ok']:
            await page.click('#b-dl'); await page.wait_for_timeout(9000)
        await shot('d07-bill-real')
        # cleanup real data from test profile view (no real data in screenshots kept for repo)
        print('DOWNLOADS', os.listdir(os.path.expanduser('~/Downloads/VidyutSewa')) if os.path.isdir(os.path.expanduser('~/Downloads/VidyutSewa')) else [])
asyncio.run(main())
print('ERRORS', json.dumps(errors[:20], indent=1))
