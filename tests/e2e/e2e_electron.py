
import asyncio, json, sys, glob, os, time, base64, io, re
from playwright.async_api import async_playwright
EXE=(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')) or [None])[0]
W=sys.argv[1]; OUT=sys.argv[2]; VAR=sys.argv[3] if len(sys.argv)>3 else 'society'; MOCK='https://127.0.0.1:8443'
DRV=open(W+'/web/js/vsdrv.js').read()
os.makedirs(OUT,exist_ok=True)
errors=[]; steps=[]
def ok(name, cond, extra=''):
    steps.append((name, bool(cond), str(extra)[:200])); print(('PASS ' if cond else 'FAIL ')+name+(' | '+str(extra) if extra and not cond else ''))
async def main():
    UD='/tmp/elec-ud'
    async with async_playwright() as p:
        b=await p.chromium.connect_over_cdp('http://127.0.0.1:9333')
        ctx=b.contexts[0]
        t0=time.time(); pa=None
        while time.time()-t0<30 and not pa:
            for pg in ctx.pages:
                if pg.url.startswith('app://'): pa=pg
            await asyncio.sleep(0.5)
        print('app page', pa.url if pa else None, [pg.url[:60] for pg in ctx.pages])
        pa.on('pageerror', lambda e: errors.append('pageerror: '+str(e)))
        pa.on('console', lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
        await pa.evaluate("window.__vsPollMs=1500")
        class PBProxy:
            """the hidden official window: looked up fresh each time (it is created by the app on first use)"""
            def _pg(self):
                for pg in ctx.pages:
                    if 'wss.mahadiscom.in' in pg.url: return pg
                raise Exception('no official page open: '+str([pg.url[:50] for pg in ctx.pages]))
            def __getattr__(self, n): return getattr(self._pg(), n)
        pb=PBProxy()
        state={'creds':None}
        async def payclicker():
            while True:
                await asyncio.sleep(0.7)
                for pg in ctx.pages:
                    try:
                        if 'wss.mahadiscom.in' in pg.url and await pg.locator('#btnPayNow').count():
                            await pg.click('#btnPayNow'); print('payclicker: clicked Pay Now on the revealed official page'); await asyncio.sleep(2.5); await pg.click('#vs-bar >> text=Back To App'); print('payclicker: clicked Back To App'); return
                    except Exception: pass
        async def shot(n):
            await pa.wait_for_timeout(350); await pa.screenshot(path=os.path.join(OUT,n+'.png'))
        async def settle(sel=None, t=20000):
            if sel: await pa.wait_for_selector(sel, timeout=t)
            await pa.wait_for_function("(function(){var s=window.NAUI_state&&NAUI_state();return !s||!s.busy})()", timeout=t)
            await pa.wait_for_timeout(300)
        state['payclick']=asyncio.ensure_future(payclicker())
        state['ud']=UD
        try:
          await run_flow(pa,pb,b,state,shot,settle)
        except Exception as e:
          print('EXC',str(e)[:300])
          try:
            print('STATE', json.dumps(await pa.evaluate("(function(){var s=NAUI_state();return s?{step:s.step,err:s.err,busy:s.busy,diag:s.diag.slice(-12)}:null})()"))[:2500])
          except Exception as e2: print('nostate',e2)
          await pa.screenshot(path=OUT+'/fail.png')
        state['payclick'].cancel()
    print('JS errors:', errors[:5])
    npass=sum(1 for s in steps if s[1]); print('RESULT %d/%d'%(npass,len(steps)))
    json.dump({'steps':steps,'errors':errors[:10]}, open(OUT+'/result.json','w'))

async def mocklog():
    import urllib.request
    import ssl; return json.loads(urllib.request.urlopen(MOCK+'/__log', context=ssl._create_unverified_context()).read())
async def run_flow(pa,pb,b,state,shot,settle):
        global OUT
        import urllib.request, ssl; urllib.request.urlopen(MOCK+'/__reset', context=ssl._create_unverified_context()).read()
        await pa.reload(); await pa.wait_for_timeout(3200); await pa.evaluate('window.__vsPollMs=1500')
        await pa.fill('#m-shop','Yuvi Online Services'); await pa.click('text=Continue'); await pa.wait_for_timeout(400)
        await pa.click('nav >> text=Applications'); await pa.wait_for_timeout(300)
        await pa.click('text=New Application >> nth=0')
        await settle('text=Apply For Change Of Name'); await shot('na01-start')
        ok('start screen shows type choice', await pa.is_visible('text=Spelling Correction - 1 PDF'))
        await pa.click('text=Start')
        await settle('[data-k="login.user"]'); await pa.wait_for_timeout(800); await shot('na02-login')
        ok('captcha image shown in app', await pa.evaluate("!!document.querySelector('img[alt=captcha]')"))
        cap=await pb.evaluate("fetch('/__cap').then(r=>r.text())")
        await pa.fill('[data-k="login.user"]','yuvishop'); await pa.fill('[data-k="login.pass"]','Pass@123'); await pa.fill('[data-k="login.captcha"]',cap)
        await pa.click('.check >> text=Remember On This Phone'); 
        await pa.click('button:has-text("Login") >> nth=-1')
        MODE=os.environ.get('MOCK_LOGIN','classic')
        if MODE=='lagcreds':
            await settle('text=Select Consumer', 90000)
        else:
            await settle('[data-k="login.otp"]', 30000); await shot('na03-login-otp')
            ok('login asks OTP in app', True)
            await pa.fill('[data-k="login.otp"]','123456'); await pa.click('text=Verify OTP And Login')
            await settle('text=Select Consumer', 90000)
        await pa.wait_for_timeout(500); await shot('na04-accounts')
        if MODE!='classic':
            lg=await mocklog(); nav=[x for x in lg if x['act']=='getCustAccountLogin' and x['m']=='GET']
            ok('left-menu Login link was never followed (login page loaded once)', len(nav)==1, len(nav))
            dg=await pa.evaluate("NAUI_state().diag.map(function(d){return d.kind+':'+d.what})")
            ok('login state diagnostics recorded', any(x.startswith('state:') for x in dg), dg[-4:])
            if MODE in ('lag','lagcreds'): ok('soft recheck found the logged-in page', any(x.startswith('recheck:') for x in dg), dg[-6:])
            if os.environ.get('LOGIN_ONLY'): return
        ok('login never stored as plain text (Linux test box has no OS key store, so nothing is saved; Windows uses DPAPI)', not any(b'Pass@123' in open(os.path.join(dp,f),'rb').read() for dp,_,fs in os.walk(state['ud']) for f in fs if not os.path.islink(os.path.join(dp,f)) and os.path.getsize(os.path.join(dp,f))<2000000 and 'Cache' not in dp))
        NC=int(os.environ.get('MOCK_CONS','2'))
        n_rows=await pa.locator('#cons-list .modecard').count(); ok('consumers listed (%d)'%NC, n_rows==NC, n_rows)
        await pa.wait_for_timeout(1500)
        rows_txt=await pa.inner_text('#cons-list')
        ok('every row shows the consumer NAME (bold) from the list', 'TABASSUM NISHA' in rows_txt and 'RAMESH KUMAR' in rows_txt, rows_txt[:160])
        ok('number still shown under the name', '092236112147' in rows_txt)
        # search: name (case-insensitive, substring, extra spaces ignored), number (digits substring), empty state, pinned bar
        async def shown(): return await pa.locator('#cons-list .modecard').count()
        NM=None
        Q1='api name 2147' if NM else 'tabas'; Q2='  API   name 5678 ' if NM else '  RaMesh    kumar '; Q3='api name' if NM else 'suresh patil'
        await pa.fill('#cons-q',Q1); await pa.wait_for_timeout(150); ok('search by name (substring, lower case)', await shown()==1, await shown())
        await pa.fill('#cons-q',Q2); await pa.wait_for_timeout(150); ok('search ignores extra spaces and case', await shown()==1, await shown())
        await pa.fill('#cons-q','0922'); await pa.wait_for_timeout(150); ok('search by number digits (substring)', await shown()==1 and '092236112147' in await pa.inner_text('#cons-list'))
        await pa.fill('#cons-q','zzzz'); await pa.wait_for_timeout(150); ok('empty state: No Consumers Found', await pa.is_visible('#cons-list >> text=No Consumers Found'))
        await shot('na04b-search-empty')
        await pa.fill('#cons-q',''); await pa.wait_for_timeout(150); ok('clearing the search shows all again', await shown()==NC, await shown())
        if NC>10:
            await pa.evaluate("document.getElementById('content').scrollTop=600"); await pa.wait_for_timeout(200)
            top=await pa.evaluate("document.getElementById('cons-q').getBoundingClientRect().top"); hdr=await pa.evaluate("document.querySelector('.hdr').getBoundingClientRect().bottom")
            ok('long list: search bar stays pinned while scrolling', await pa.evaluate("document.getElementById('content').scrollTop")>100 and top < hdr+60, (top,hdr))
            await pa.fill('#cons-q',Q3); await pa.wait_for_timeout(200); ok('long list: search finds names among %d'%NC, 0 < await shown() <= NC and (NM or await shown() < NC), await shown())
            await pa.fill('#cons-q','1500'); await pa.wait_for_timeout(200)
            await pa.fill('#cons-q','')
        await pa.fill('#cons-q','092236'); await pa.wait_for_timeout(150)
        await pa.click('#cons-list .modecard >> nth=0'); await pa.click('button:has-text("Continue")')
        await settle('[data-k="f.first"]', 30000); await shot('na05-form-empty')
        titles=await pa.evaluate("Array.from(document.querySelectorAll('[data-k=\"f.title\"] option')).map(o=>o.value)")
        ok('title list read from site', 'M/S' in titles and 'Smt' in titles, titles)
        reasons=await pa.evaluate("Array.from(document.querySelectorAll('[data-k=\"f.reason\"] option')).map(o=>o.value)")
        ok('reason list read from site', any('11 - Change in Ownership' in r for r in reasons), reasons)
        # M/S: ONE single-line Name; First / Middle / Last do not exist
        await pa.select_option('[data-k="f.title"]','M/S'); await pa.wait_for_timeout(300)
        ok('M/S: no Middle / Last field on screen', await pa.locator('[data-k="f.middle"]').count()==0 and await pa.locator('[data-k="f.last"]').count()==0)
        ok('M/S: one single-line Name field (no First Name label)', await pa.locator('[data-k="f.first"]').count()==1 and await pa.is_visible('label:has-text("Name *") >> nth=0') and not await pa.is_visible('label:has-text("First Name")'))
        await shot('na05b-ms-layout')
        await pa.locator('[data-k="f.first"]').press_sequentially('a'*60, delay=2)
        n=await pa.evaluate("document.querySelector('#nm-full').value.length"); ok('M/S name blocked at 50 chars together with the title', n==50, n)
        cnt=await pa.inner_text('#nm-count'); ok('counter shows 50 / 50', '50 / 50' in cnt, cnt)
        ok('typed lower case becomes UPPER CASE in the field', await pa.input_value('[data-k="f.first"]')==('A'*46), await pa.input_value('[data-k="f.first"]'))
        await pa.fill('[data-k="f.first"]','Jai Laxmi Welfare Society')
        ok('M/S full name = "M/S " + name, upper case', await pa.input_value('#nm-full')=='M/S JAI LAXMI WELFARE SOCIETY', await pa.input_value('#nm-full'))
        if VAR=='resident':   # a person: compact rows, auto full name (upper case)
            await pa.select_option('[data-k="f.title"]','Mr'); await pa.wait_for_timeout(300)
            ok('non-M/S: Middle and Last come back (compact rows)', await pa.locator('[data-k="f.middle"]').count()==1 and await pa.locator('[data-k="f.last"]').count()==1)
            await pa.fill('[data-k="f.first"]','ramesh'); await pa.fill('[data-k="f.last"]','patil'); await pa.dispatch_event('[data-k="f.last"]','input')
            ok('Mr: full name auto composed, upper case', await pa.input_value('#nm-full')=='Mr RAMESH PATIL', await pa.input_value('#nm-full'))
        await pa.fill('[data-k="f.email"]','yuvi@example.com'); await pa.fill('[data-k="f.mobile"]','9876543210')
        await pa.select_option('[data-k="f.reason"]',label='11 - Change in Ownership')
        await shot('na06-form-filled')
        await pa.click('button:has-text("Next")')
        await settle('text=Aadhaar Authentication', 30000); await shot('na07-aadhaar')
        site_full=await pb.input_value('#txtConsumerFullName'); want_full='Mr RAMESH PATIL' if VAR=='resident' else 'M/S JAI LAXMI WELFARE SOCIETY'
        ok('official page got the same composed name', site_full==want_full, site_full)
        ok('official page title/email/mobile/reason filled', (await pb.input_value('#txtEmail'))=='yuvi@example.com' and (await pb.input_value('#txtMobile'))=='9876543210' and (await pb.input_value('#ddlReason'))=='11')
        GOOD='234567890124'; BAD='234567890125'
        ok('every step screen has Diagnostics + Open Official Page', await pa.is_visible('.fbrow >> text=Diagnostics') and await pa.is_visible('.fbrow >> text=Open Official Page'))
        if VAR=='resident':
            ok('required Aadhaar: the button says Next, not Skip', await pa.is_visible('button:has-text("Next") >> nth=-1') and not await pa.is_visible('button:has-text("Skip")'))
            await pa.click('button:has-text("Next") >> nth=-1'); await pa.wait_for_timeout(400)
            ok('Next is refused until Aadhaar is verified (residential)', await pa.is_visible('text=Aadhaar Verification Needed') and await pa.is_visible('text=Aadhaar Authentication'))
            await pa.click('.check >> text=I Give My Consent'); await settle('[data-k="aad.no"]')
            ok('official consent box ticked (real id)', await pb.evaluate("document.getElementById('chkUIDAIConcent').checked"))
            await pa.fill('[data-k="aad.no"]',BAD); await pa.wait_for_timeout(200)
            ok('bad checksum: inline message, Generate disabled', await pa.is_visible('text=This Aadhaar Number Looks Invalid, Please Check') and await pa.is_disabled('#aad-gen'))
            ok('bad checksum never reaches the official site', not [x for x in await mocklog() if x['act']=='generateAadharOTPUIDAI'])
            await pa.fill('[data-k="aad.no"]',GOOD); await pa.wait_for_timeout(200)
            ok('good number: Generate enabled, no invalid message', not await pa.is_disabled('#aad-gen') and not await pa.is_visible('text=This Aadhaar Number Looks Invalid'))
            NOMATCH=os.environ.get('MOCK_AADMOB')=='nomatch'
            await pa.click('#aad-gen'); await settle('[data-k="aad.otp"]', 30000); await pa.wait_for_timeout(500); await shot('na07b-aadhaar-otp')
            lg=[x for x in await mocklog() if x['act']=='generateAadharOTPUIDAI']
            ok('official page received all 12 digits (typed key by key)', lg and lg[-1]['lens'].get('AadharNo')==12 and lg[-1]['digits'].get('AadharNo'), lg[-1:] )
            ok('real Aadhaar box masked itself, hidden field holds 12', await pb.evaluate("document.getElementById('txtAadharNo').value.indexOf('*')>=0 && document.getElementById('hdnAadharNum').value.length==12"))
            if NOMATCH:
                ok('site left the mobile box empty: Linked Mobile box NOT shown, last 4 shown, editable input offered', not await pa.is_visible('.card.glow') and await pa.is_visible('text=Ending') and await pa.is_visible('[data-k="aad.mob"]'))
                await pa.fill('[data-k="aad.mob"]','9000001111'); await pa.fill('[data-k="aad.otp"]','246810'); await pa.click('button:has-text("Verify")'); await pa.wait_for_timeout(600)
                ok('wrong last 4 refused before touching the site', await pa.is_visible('text=This Mobile Does Not End With'))
                await pa.fill('[data-k="aad.mob"]','9000003210')
            else:
                mob=await pa.inner_text('.card.glow .mono'); ok('aadhaar linked mobile shown in full, unmasked, as the site filled it', mob.strip()=='9876543210', mob)
            ok('no error box on success', not await pa.is_visible('#aad-err'))
            await pa.fill('[data-k="aad.otp"]','246810'); await pa.click('button:has-text("Verify")'); await pa.wait_for_function("(function(){var s=NAUI_state();return !s.busy})()"); await pa.wait_for_timeout(1500)
            if NOMATCH: ok('typed mobile went into the site box', await pb.evaluate("document.getElementById('txtAadharMobNo').value")=='9000003210')
            ok('aadhaar verified (site flag hdnIsAadharAuthenticated=Y)', await pa.is_visible('text=Verified') and await pb.evaluate("document.getElementById('hdnIsAadharAuthenticated').value")=='Y'); await shot('na07c-aadhaar-verified')
            dgs=await pa.evaluate("JSON.stringify(NAUI_state().diag.filter(function(d){return d.step==='aadhaar'||d.kind==='aadhaar'}))")
            ok('Aadhaar diagnostics: lengths and element ids only', 'typed length 12' in dgs and 'hdnAadharNum' in dgs and 'btnUIDAIGenerateOTP' in dgs, dgs[:500])
            ok('Aadhaar diagnostics never hold the number, the mobile or the OTP', GOOD not in dgs and '9876543210' not in dgs and '246810' not in dgs and '3210' not in dgs.replace('****3210','') , dgs[:300])
        else:
            await pa.click('.check >> text=I Give My Consent'); await pa.wait_for_timeout(600)
            ok('optional aadhaar (name has Society): skip offered', await pa.is_visible('button:has-text("Skip")'))
        ok('aadhaar number/otp not kept in app state (checked after leaving page)', True)
        await pa.click('button:has-text("Skip"), button:has-text("Next") >> nth=-1')
        await pa.wait_for_timeout(500)
        ok('aadhaar number gone from memory', await pa.evaluate("JSON.stringify(NAUI_state()).indexOf('%s')"%GOOD)==-1 and await pa.evaluate("JSON.stringify(NAUI_state()).indexOf('246810')")==-1)
        await settle('text=Declaration And Submit', 30000); await shot('na08-confirm')
        await pa.click('.check >> text=I Agree To The Declaration'); await pa.fill('[data-k="p3.place"]','Pune')
        await pa.click('text=Generate OTP (Mobile + Email)'); await settle('[data-otp]', 20000); await shot('na09-otp')
        ok('the site pop-up (where the OTP went) is shown in the app', await pa.is_visible('text=OTP Sent To') and 'xxxxxx3210' in await pa.inner_text('.card.acc'), await pa.inner_text('.card.acc'))
        ok('two otp boxes from site (mobile + email)', await pa.locator('[data-otp]').count()==2, await pa.locator('[data-otp]').count())
        boxes=pa.locator('[data-otp]'); await boxes.nth(0).fill('111111'); await boxes.nth(1).fill('222222')
        log0=await mocklog(); ok('nothing submitted before the tap', not any(x['act']=='submitName' for x in log0))
        await pa.click('button:has-text("Submit To MSEDCL")'); await pa.wait_for_selector('text=Submit To MSEDCL? >> nth=0'); await shot('na10-submit-confirm')
        log1=await mocklog(); ok('confirm sheet blocks the submit', not any(x['act']=='submitName' for x in log1))
        await pa.click('#cb-yes')
        await settle('text=Upload Documents', 40000); await pa.wait_for_timeout(800); await shot('na11-docs')
        appno=await pa.inner_text('.card.glow .mono'); ok('application number captured', re.match(r'^\d{8}$',appno.strip()), appno)
        sub=[x for x in await mocklog() if x['act']=='submitName']
        ok('site received title+name+reason+place', sub and sub[0]['fields'].get('title')==('Mr' if VAR=='resident' else 'M/S') and sub[0]['fields'].get('fullName')==('Mr RAMESH PATIL' if VAR=='resident' else 'M/S JAI LAXMI WELFARE SOCIETY') and sub[0]['fields'].get('place')=='Pune' and sub[0]['fields'].get('reason')=='11', sub[:1])
        ok('app saved the application in the list', await pa.evaluate("!!VS.findApp('%s')" % appno.strip()))
        nslots=await pa.locator('#content .card:has(button:has-text("Choose File"))').count(); ok('upload slots built from the site list', nslots in (2,3), nslots)
        # make files
        from PIL import Image
        os.makedirs('/tmp/na',exist_ok=True)
        def mkpdf(path, mb):
            im=Image.effect_noise((1800,2400), 80).convert('RGB') if mb else Image.new('RGB',(600,800),'white'); im.save(path,'JPEG',quality=95 if mb else 70)
        mkpdf('/tmp/na/Small file (1).jpg',0); mkpdf('/tmp/na/Big scan.jpg',1)
        slots=pa.locator('#content .card:has(button:has-text("Choose File"))')
        for i in range(nslots):
            async with pa.expect_file_chooser() as fc:
                await slots.nth(0).locator('button:has-text("Choose File")').click()
            await (await fc.value).set_files('/tmp/na/Big scan.jpg' if i==0 else '/tmp/na/Small file (1).jpg')
            await pa.wait_for_timeout(2500)
        await shot('na12-docs-ready')
        await pa.click('button:has-text("Upload All")'); await pa.wait_for_timeout(9000); await shot('na13-docs-uploaded')
        ups=[x for x in await mocklog() if x['act']=='uploadDoc']
        ok('files reached the site with clean names under 1 MB', ups and all(re.match(r'^[A-Za-z0-9_-]+\.pdf$',list(x['files'].values())[0][0]) and list(x['files'].values())[0][1]<=1048576 for x in ups), ups)
        ok('all slots uploaded', len(ups)==nslots, len(ups))
        await pa.click('button:has-text("Continue To Payment")'); await settle('text=Pay On Official Site'); await pa.wait_for_timeout(600); await shot('na14-pay')
        ok('fee shown from the site', await pa.is_visible('text=%s' % ('₹180' if VAR=='society' else '₹130')))
        await pa.click('text=Pay On Official Site')
        await settle('text=Waiting For Receipt', 30000); await shot('na15-wait')
        await pa.wait_for_selector('text=Payment Successful', timeout=60000); await pa.wait_for_timeout(800); await shot('na16-receipt')
        files=await pa.evaluate("Promise.all([Native.call('readDoc',{id:'%s',slot:'receiptimg'}),Native.call('readDoc',{id:'%s',slot:'receiptpdf'})]).then(function(r){return {i:!!r[0],p:!!r[1]}})" % (appno.strip(),appno.strip()))
        ok('receipt image + pdf saved in vault', files['i'] and files['p'], files)
        pdf=await pa.evaluate("Native.call('readDoc',{id:'%s',slot:'receiptpdf'}).then(function(r){return r.b64})" % appno.strip()); raw=base64.b64decode(pdf)
        ok('receipt pdf is the official one', b'MOCK RECEIPT' in raw, raw[:30])
        img=await pa.evaluate("Native.call('readDoc',{id:'%s',slot:'receiptimg'}).then(function(r){return r.b64})" % appno.strip()); ok('receipt image is a jpeg', base64.b64decode(img)[:3]==b'\xff\xd8\xff')
        open(OUT+'/receipt.jpg','wb').write(base64.b64decode(img))
        ok('app shows receipt on application', await pa.evaluate("!!VS.findApp('%s').receipt" % appno.strip()))
        await pa.click('text=Done'); await pa.wait_for_timeout(700); await shot('na17-detail')
        ok('detail shows receipt card', await pa.is_visible('text=Payment Receipt'))
        # diagnostics
        await pa.evaluate("UI.newApp()"); await pa.wait_for_timeout(300)
        for _ in range(5): await pa.click('.hdr h1')
        await pa.wait_for_timeout(800); await shot('na18-diag')
        ok('diagnostics screen opens on 5 taps', await pa.is_visible('text=Step Log'))
        log=await mocklog()
        ok('password reached site only encrypted by site js', any(x['act']=='login' and x['fields'].get('password')=='***' for x in log))
asyncio.run(main())
