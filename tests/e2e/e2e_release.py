
# Browser tests for 1.1.3: What's New + update check. Usage: python3 e2e_release.py <project dir> <out dir>   (serves web/ itself on :8091)
import asyncio, json, sys, glob, os, time, datetime, subprocess
from playwright.async_api import async_playwright
EXE=(glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')) or [None])[0]
W=sys.argv[1]; OUT=sys.argv[2]; os.makedirs(OUT,exist_ok=True)
PORT=8091; URL='http://127.0.0.1:%d/index.html'%PORT
MAN='https://raw.githubusercontent.com/FilmyFather/vidyutsewa/main/update/latest.json'
steps=[]
def ok(name,cond,extra=''):
    steps.append((name,bool(cond))); print(('PASS ' if cond else 'FAIL ')+name+(' | '+str(extra) if extra and not cond else ''))
today=datetime.datetime.utcnow().date()
def day(delta): return (today+datetime.timedelta(days=delta)).isoformat()
def man(**o):
    m={'latestVersion':'1.2.0','releasedAt':day(-3),'graceDays':15,'apkUrl':'https://example.test/app.apk','installerUrl':'https://example.test/setup.exe','releaseUrl':'https://example.test/release','changelog':['Faster Bill Check','Better Search']}
    m.update(o); return json.dumps(m)
SEED_OLD=json.dumps({'v':1,'settings':{'onboarded':True,'mode':'shop','shopName':'Yuvi Online Services'},'apps':[],'bills':[],'activity':[],'notes':[]})   # an install from 1.1.2: no lastSeenVersion
def seed_cur(**s):
    st={'onboarded':True,'mode':'shop','shopName':'Yuvi Online Services','lastSeenVersion':'1.1.3'}; st.update(s)
    return json.dumps({'v':1,'settings':st,'apps':[],'bills':[],'activity':[],'notes':[]})
async def newpage(b, data=None, body=None, status=200, abort=False, delay=0, w=400, h=860):
    ctx=await b.new_context(viewport={'width':w,'height':h})
    pg=await ctx.new_page(); pg.reqs=[]; pg.errs=[]
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    async def guard(route):
        u=route.request.url
        if u.startswith('http://127.0.0.1') or u.startswith(('data:','blob:','about:')): return await route.continue_()
        if u==MAN:
            pg.reqs.append(route.request)
            if delay: await asyncio.sleep(delay)
            if abort: return await route.abort()
            return await route.fulfill(status=status, body=body if body is not None else '', headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'})
        pg.errs.append('EXTERNAL '+u); await route.abort()
    await ctx.route('**/*', guard)
    init="window.__opened=[];window.open=function(u){window.__opened.push(u);return null};"
    if data is not None: init+="if(!localStorage.getItem('__seeded')){localStorage.setItem('vs-data',%s);localStorage.setItem('__seeded','1')}"%json.dumps(data)
    await pg.add_init_script(init)
    await pg.goto(URL); await pg.wait_for_timeout(4200)
    return pg
async def vis(pg, sel): return await pg.is_visible(sel)
async def home_ok(pg): return await pg.evaluate("UI.route==='home' && !!document.querySelector('#content') && getComputedStyle(document.getElementById('root')).display!=='none'")

async def main():
    srv=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=W+'/web',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(executable_path=EXE,args=['--no-sandbox'])
            # ---- What's New: Settings -> About -> What's New
            pg=await newpage(b, seed_cur(), man(latestVersion='1.1.3'))
            ok('current install: no What\'s New popup, no update popup', not await vis(pg,'.sheetwrap') and await home_ok(pg))
            await pg.evaluate("UI.go('settings')"); await pg.wait_for_timeout(400)
            ok('About has a What\'s New button', await pg.locator("text=What's New").count()>=1)
            await pg.locator("button:has-text(\"What's New\")").first.click(); await pg.wait_for_timeout(400)
            vs=await pg.evaluate("Array.from(document.querySelectorAll('.wn-v b')).map(e=>e.textContent)")
            ok('What\'s New lists 1.1.3 on top, newest first', vs==['Version 1.1.3','Version 1.1.2','Version 1.1.1','Version 1.1.0','Version 1.0.1','Version 1.0.0'], vs)
            txt=await pg.inner_text('.wn'); ok('1.1.3 text mentions installer, changelog, update pop-up', 'Windows Setup Installer' in txt and 'New Version Available' in txt and 'Aadhaar Step Fixed' in txt)
            ok('What\'s New screen has the footer', 'Designed & Developed By' in await pg.inner_text('.foot'))
            await pg.screenshot(path=OUT+'/wn-screen.png')
            await pg.evaluate("UI.back()"); await pg.wait_for_timeout(300); ok('Back leaves What\'s New', await pg.evaluate("UI.route")=='settings')
            await pg.context.close()
            # ---- once after update
            pg=await newpage(b, SEED_OLD, man(latestVersion='1.1.3'))
            ok('after update (1.1.2 -> 1.1.3): What\'s New pops up by itself', await vis(pg,'.wnpop'))
            t=await pg.inner_text('.sheet'); ok('popup shows 1.1.3 + Close button', 'Version 1.1.3' in t and await vis(pg,'.sheet >> text=Close'))
            await pg.screenshot(path=OUT+'/wn-popup.png')
            await pg.click('.sheet >> text=Close'); await pg.wait_for_timeout(300); ok('Close dismisses it', not await vis(pg,'.sheetwrap'))
            saved=json.loads(await pg.evaluate("localStorage.getItem('vs-data')")) if await pg.evaluate("!!localStorage.getItem('vs-data')") else {}
            await pg.wait_for_timeout(500); await pg.evaluate("VS.save(true)"); await pg.wait_for_timeout(400)
            saved=json.loads(await pg.evaluate("localStorage.getItem('vs-data')")); ok('seen version stored (1.1.3)', saved['settings'].get('lastSeenVersion')=='1.1.3', saved['settings'])
            await pg.reload(); await pg.wait_for_timeout(4200); ok('second launch: popup does NOT come again', not await vis(pg,'.sheetwrap'))
            await pg.context.close()
            pg=await newpage(b, None, man(latestVersion='1.1.3'))
            ok('fresh install: no What\'s New popup', not await vis(pg,'.sheetwrap')); await pg.context.close()
            # ---- update check
            pg=await newpage(b, seed_cur(), man())
            ok('exactly ONE anonymous GET at launch', len(pg.reqs)==1)
            r=pg.reqs[0]; ok('request carries no cookies/body/query', r.method=='GET' and not r.post_data and '?' not in r.url and 'cookie' not in {k.lower() for k in r.headers}, r.headers)
            ok('newer within grace: New Version Available popup', await vis(pg,'.updpop') and 'New Version Available' in await pg.inner_text('.updpop'))
            t=await pg.inner_text('.updpop'); ok('popup shows version, what\'s new lines, days left', 'Version 1.2.0 Is Ready. You Have Version 1.1.3.' in t and 'Faster Bill Check' in t and 'Update Required In 12 Days' in t, t)
            ok('buttons Update Now + Later only', await pg.locator('.updpop .btn').count()==2)
            await pg.screenshot(path=OUT+'/upd-popup.png')
            await pg.click('#up-now'); await pg.wait_for_timeout(200); ok('Update Now opens the download page', (await pg.evaluate("window.__opened"))==['https://example.test/release'], await pg.evaluate("window.__opened"))
            await pg.click('#up-later'); await pg.wait_for_timeout(300); ok('Later closes it and the app works', not await vis(pg,'.updpop') and await home_ok(pg))
            await pg.evaluate("UI.go('settings')"); await pg.wait_for_timeout(300); ok('app still navigable after Later', await pg.evaluate("UI.route")=='settings')
            await pg.context.close()
            pg=await newpage(b, seed_cur(lang='hi'), man(releasedAt=day(-14)))
            t=await pg.inner_text('.updpop'); ok('Hindi popup: translated title and 1 day left', 'नया वर्ज़न उपलब्ध है' in t and '1 दिन में अपडेट ज़रूरी है' in t, t)
            await pg.screenshot(path=OUT+'/upd-popup-hi.png'); await pg.context.close()
            pg=await newpage(b, seed_cur(), man(releasedAt=day(-30)))
            ok('past grace: full-screen Update Required', await vis(pg,'.updblock') and 'Update Required' in await pg.inner_text('.updblock'))
            btn=await pg.evaluate("Array.from(document.querySelectorAll('.updblock button')).map(b=>b.textContent.trim())"); ok('only Update Now + Close', sorted(btn)==['Close','Update Now'], btn)
            ok('normal app hidden behind the block', not await vis(pg,'#root'))
            ok('blocked screen has the footer', 'Designed & Developed By' in await pg.inner_text('.updblock .foot'))
            await pg.screenshot(path=OUT+'/upd-required.png')
            await pg.evaluate("try{UI.go('settings')}catch(e){}"); ok('flow cannot be reached (root stays hidden)', not await vis(pg,'#root'))
            await pg.click('#ub-now'); ok('Update Now works on the block screen', (await pg.evaluate("window.__opened"))==['https://example.test/release'])
            await pg.context.close()
            for th in ['royal','emerald','sunset','aurora']:
                pg=await newpage(b, seed_cur(themeStyle=th, theme='light' if th in('sunset','aurora') else 'dark'), man(releasedAt=day(-30)))
                await pg.screenshot(path=OUT+'/upd-required-%s.png'%th); await pg.context.close()
            ok('4 themes rendered the blocker (screenshots)', True)
            pg=await newpage(b, seed_cur(), man(releasedAt=day(-30), graceDays=40)); ok('graceDays 40 from manifest: still only a popup', await vis(pg,'.updpop') and not await vis(pg,'.updblock')); await pg.context.close()
            pg=await newpage(b, seed_cur(), man(releasedAt=day(-12), graceDays=10)); ok('graceDays 10 from manifest: 12 days old = blocked', await vis(pg,'.updblock')); await pg.context.close()
            pg=await newpage(b, seed_cur(), man(releasedAt=day(+400), graceDays=1)); ok('future release date is ignored (popup only, never blocked)', await vis(pg,'.updpop') and not await vis(pg,'.updblock')); await pg.context.close()
            pg=await newpage(b, seed_cur(), man(latestVersion='1.1.3', releasedAt=day(-300))); ok('installed == latest: nothing at all', not await vis(pg,'.updpop') and not await vis(pg,'.updblock') and await home_ok(pg)); await pg.context.close()
            pg=await newpage(b, seed_cur(), man(latestVersion='1.0.0', releasedAt=day(-300))); ok('installed newer than manifest: nothing', not await vis(pg,'.updpop') and not await vis(pg,'.updblock')); await pg.context.close()
            # fail open
            for name,kw in [('offline (request fails)',dict(abort=True)),('404',dict(body='404: Not Found',status=404)),('garbled text',dict(body='<<<not json>>>')),('wrong shape',dict(body='[1,2,3]')),('missing fields',dict(body='{"latestVersion":"9.9.9"}')),('bad date',dict(body=man(releasedAt='yesterday'))),('500',dict(body='oops',status=500))]:
                pg=await newpage(b, seed_cur(), **kw); ok('fail open - '+name+': opens normally', await home_ok(pg) and not await vis(pg,'.updpop') and not await vis(pg,'.updblock'), name); await pg.context.close()
            pg=await newpage(b, seed_cur(), man(releasedAt=day(-30)), delay=12); ok('very slow manifest (12 s): app opens normally meanwhile', await home_ok(pg) and not await vis(pg,'.updblock')); await pg.wait_for_timeout(9000); ok('...and a too-late answer (past 8 s) is ignored', not await vis(pg,'.updblock')); await pg.context.close()
            # never mid-form
            pg=await newpage(b, seed_cur(), man(releasedAt=day(-30)), delay=3, w=400, h=860)
            await pg.context.close()
            ctx=await b.new_context(viewport={'width':400,'height':860}); pg=await ctx.new_page()
            async def g2(route):
                u=route.request.url
                if u.startswith('http://127.0.0.1') or u.startswith(('data:','blob:')): return await route.continue_()
                if u==MAN: await asyncio.sleep(3.5); return await route.fulfill(status=200,body=man(releasedAt=day(-30)),headers={'Access-Control-Allow-Origin':'*'})
                await route.abort()
            await ctx.route('**/*', g2)
            await pg.add_init_script("localStorage.getItem('__s')||(localStorage.setItem('vs-data',%s),localStorage.setItem('__s','1'))"%json.dumps(seed_cur()))
            await pg.goto(URL); await pg.wait_for_timeout(2300)
            await pg.evaluate("UI.go('na')"); await pg.wait_for_timeout(3500)
            ok('never mid-form: answer arriving inside the New Application form is not acted on', not await vis(pg,'.updblock') and not await vis(pg,'.updpop') and await pg.evaluate("UI.route")=='na', await pg.evaluate("UI.route"))
            await ctx.close()
            # manual check
            pg=await newpage(b, seed_cur(), man(latestVersion='1.1.3'))
            await pg.evaluate("UI.go('settings')"); await pg.wait_for_timeout(300); await pg.click('#updbtn'); await pg.wait_for_timeout(900)
            ok('Settings > Check For Updates, up to date: toast says latest', 'Latest Version' in await pg.inner_text('.toast'))
            await pg.context.close()
            pg=await newpage(b, seed_cur(), man()); await pg.click('#up-later'); await pg.evaluate("UI.go('settings')"); await pg.wait_for_timeout(300)
            await pg.click('#updbtn'); await pg.wait_for_timeout(900); ok('manual check with a newer version: popup again', await vis(pg,'.updpop')); await pg.context.close()
            # footer on every new screen / no errors
            await b.close()
    finally:
        srv.terminate()
    n=sum(1 for s in steps if s[1]); print('RESULT %d/%d'%(n,len(steps)))
    json.dump(steps,open(OUT+'/result_release.json','w'))
    sys.exit(0 if n==len(steps) else 1)
asyncio.run(main())
