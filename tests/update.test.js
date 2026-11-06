// Run: node tests/update.test.js   (no dependencies)  - What's New source + update-check logic (pure functions)
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

// load the shared source files the same way the app does, with a tiny stand-in for the UI
const win = { UI: { screens: {}, back() {}, _h: {} }, I18N: { t: (s) => s } };
const ctx = vm.createContext({ window: win, UI: win.UI, Native: {}, localStorage: { getItem() { return null; }, setItem() {} }, document: { querySelector: () => null }, console });
vm.runInContext(read('web/js/changelog.js'), ctx);
vm.runInContext(read('web/js/update.js'), ctx);
const U = win.VSUpdate, R = JSON.parse(JSON.stringify(win.VS_RELEASE)), CL = JSON.parse(JSON.stringify(win.VS_CHANGELOG));
const J = (x) => JSON.parse(JSON.stringify(x));
const D = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const M = (o) => J(U.parseManifest(JSON.stringify(Object.assign({ latestVersion: '1.1.3', releasedAt: '2026-11-06', graceDays: 15, changelog: ['A'] }, o))));

t('versions: every place agrees on 1.1.4', () => {
  assert.strictEqual(R.version, '1.1.4');
  assert.strictEqual(CL[0].v, '1.1.4');
  assert.strictEqual(JSON.parse(read('desktop/package.json')).version, '1.1.4');
  assert.ok(/var VERSION = '1\.1\.4';/.test(read('web/js/app.js')));
  assert.ok(/versionName = "1\.1\.4"/.test(read('android/app/build.gradle.kts')) && /versionCode = 7/.test(read('android/app/build.gradle.kts')));
  assert.ok(read('android/app/src/main/java/com/filmyfather/vidyutsewa/MainActivity.kt').includes('put("version", "1.1.4")'));
  assert.ok(['1.1.3', '1.1.4'].includes(JSON.parse(read('update/latest.json')).latestVersion));   // 1.1.4 only after the release files are up
});
t('changelog: newest first, all versions 1.0.0..1.1.4, no duplicates', () => {
  assert.deepStrictEqual(CL.map((e) => e.v), ['1.1.4', '1.1.3', '1.1.2', '1.1.1', '1.1.0', '1.0.1', '1.0.0']);
  for (let i = 1; i < CL.length; i++) assert.ok(U.cmp(CL[i - 1].v, CL[i].v) > 0 && CL[i - 1].date >= CL[i].date);
  CL.forEach((e) => { assert.ok(e.items.length >= 3); assert.ok(U.parseDate(e.date) !== null); });
});
t('changelog: every line is Title Case English and has Hindi + Marathi', () => {
  const small = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'by', 'with', 'out', 'up', 'from', 'than', 'if', 'it', 'be', 'are', 'after', 'until', 'unless', 'while', 'into', 'as']);
  const src = read('web/js/i18n-113.js') + '\n' + read('web/js/i18n-114.js'), hi = {}, mr = {};
  const grab = (lang, into) => { const re = new RegExp("I18N\\.extend\\('" + lang + "', (\\{[\\s\\S]*?\\n\\})\\);", 'g'); let m; while ((m = re.exec(src))) Object.assign(into, JSON.parse(m[1])); };
  grab('hi', hi); grab('mr', mr);
  CL.forEach((e) => e.items.forEach((line) => {
    line.split(/[\s]+/).forEach((w) => {
      const c = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''); if (!c || /^\d/.test(c) || c === 'M/S') return;
      assert.ok(small.has(c.toLowerCase()) || /^[A-Z]/.test(c), 'Title Case: ' + line + ' -> ' + c);
    });
    assert.ok(hi[line] && mr[line], 'translation missing: ' + line);
  }));
  ['New Version Available', 'Update Now', 'Later', 'Update Required', "What's New", 'Update Required In {n} Days', 'Update Required In 1 Day'].forEach((k) => assert.ok(hi[k] && mr[k], k));
});
t('changelog.md / manifest lines come from the same source', () => {
  const md = read('CHANGELOG.md'); CL.forEach((e) => e.items.forEach((i) => assert.ok(md.includes(i))));
  { const lj = JSON.parse(read('update/latest.json')); assert.deepStrictEqual(lj.changelog, CL.find((e) => e.v === lj.latestVersion).items); }
});
t('versions compare numerically (1.10.0 > 1.9.0), junk gives null', () => {
  assert.strictEqual(U.cmp('1.10.0', '1.9.0'), 1); assert.strictEqual(U.cmp('1.1.3', '1.1.3'), 0); assert.strictEqual(U.cmp('v1.1.3', '1.1.4'), -1);
  assert.strictEqual(U.cmp('abc', '1.1.3'), null); assert.strictEqual(U.cmp('', '1.1.3'), null);
});
t('manifest: garbled / wrong shape / bad fields -> null (fail open)', () => {
  ['', 'not json', '[]', 'null', '123', '{}', '{"latestVersion":"x","releasedAt":"2026-11-06"}', '{"latestVersion":"1.2.0"}', '{"latestVersion":"1.2.0","releasedAt":"06-11-2026"}', '{"latestVersion":"1.2.0","releasedAt":"2026-13-45"}', '<html>404: Not Found</html>']
    .forEach((s) => assert.strictEqual(U.parseManifest(s), null, s));
});
t('manifest: graceDays default 15, bad values fall back, valid values kept (10)', () => {
  assert.strictEqual(M({ graceDays: undefined }).graceDays, 15); assert.strictEqual(M({ graceDays: 'x' }).graceDays, 15);
  assert.strictEqual(M({ graceDays: -3 }).graceDays, 15); assert.strictEqual(M({ graceDays: 0 }).graceDays, 15); assert.strictEqual(M({ graceDays: 100000 }).graceDays, 15);
  assert.strictEqual(M({ graceDays: 10 }).graceDays, 10);
});
t('manifest: only https URLs survive', () => {
  const m = M({ apkUrl: 'http://x.test/a.apk', installerUrl: 'javascript:alert(1)', releaseUrl: 'https://github.com/x/y/releases/tag/v1' });
  assert.strictEqual(m.apkUrl, ''); assert.strictEqual(m.installerUrl, ''); assert.strictEqual(m.releaseUrl, 'https://github.com/x/y/releases/tag/v1');
});
t('evaluate: installed == latest -> nothing; installed newer than latest -> nothing', () => {
  const now = D('2026-11-20');
  assert.strictEqual(U.evaluate(M({}), '1.1.3', now).state, 'none'); assert.strictEqual(U.evaluate(M({}), '1.2.0', now).state, 'none');
  assert.strictEqual(U.evaluate(null, '1.1.2', now).state, 'none');
});
t('evaluate: newer exists, inside grace -> optional with days left', () => {
  const m = M({ latestVersion: '1.2.0', releasedAt: '2026-11-10', graceDays: 15 });
  let e = U.evaluate(m, '1.1.3', D('2026-11-10') + 3600e3); assert.strictEqual(e.state, 'optional'); assert.strictEqual(e.daysLeft, 15);
  e = U.evaluate(m, '1.1.3', D('2026-11-20')); assert.strictEqual(e.state, 'optional'); assert.strictEqual(e.daysLeft, 5);
  e = U.evaluate(m, '1.1.3', D('2026-11-24') + 23 * 3600e3); assert.strictEqual(e.state, 'optional'); assert.strictEqual(e.daysLeft, 1);
});
t('evaluate: past grace -> required (exactly at deadline and after)', () => {
  const m = M({ latestVersion: '1.2.0', releasedAt: '2026-11-10', graceDays: 15 });
  assert.strictEqual(U.evaluate(m, '1.1.3', D('2026-11-25')).state, 'required'); assert.strictEqual(U.evaluate(m, '1.1.3', D('2027-02-01')).state, 'required');
  assert.strictEqual(U.evaluate(m, '1.1.3', D('2026-11-25') - 1).state, 'optional');
});
t('evaluate: graceDays 10 changes the deadline', () => {
  const m = M({ latestVersion: '1.2.0', releasedAt: '2026-11-10', graceDays: 10 });
  assert.strictEqual(U.evaluate(m, '1.1.3', D('2026-11-19')).state, 'optional'); assert.strictEqual(U.evaluate(m, '1.1.3', D('2026-11-20')).state, 'required');
});
t('evaluate: a release date in the future is ignored (never blocks)', () => {
  const m = M({ latestVersion: '1.2.0', releasedAt: '2030-01-01', graceDays: 1, minSupported: '1.2.0' });
  const e = U.evaluate(m, '1.1.3', D('2026-11-20')); assert.strictEqual(e.state, 'optional'); assert.strictEqual(e.daysLeft, 1);
  // today's date in a timezone ahead of UTC still counts as "today", not future
  assert.strictEqual(U.evaluate(M({ latestVersion: '1.2.0', releasedAt: '2026-11-21', graceDays: 1 }), '1.1.3', D('2026-11-20') + 20 * 3600e3).state, 'optional');
});
t('evaluate: minSupported blocks older installs at once, only when the date is valid', () => {
  const m = M({ latestVersion: '1.2.0', releasedAt: '2026-11-10', graceDays: 15, minSupported: '1.1.3' });
  assert.strictEqual(U.evaluate(m, '1.1.2', D('2026-11-11')).state, 'required'); assert.strictEqual(U.evaluate(m, '1.1.3', D('2026-11-11')).state, 'optional');
});
t('the manifest in the repo is valid: the latest version sees nothing, the previous one gets a popup (not a block) inside the grace days', () => {
  const m = U.parseManifest(read('update/latest.json')); assert.ok(m); assert.strictEqual(m.graceDays, 15);
  assert.strictEqual(U.evaluate(m, m.latestVersion, D('2030-06-01')).state, 'none');
  const prev = CL[1].v, rel = typeof m.releasedAt === 'number' ? m.releasedAt : D(m.releasedAt);
  assert.strictEqual(U.evaluate(m, prev, rel + 2 * 86400e3).state, 'optional');
  assert.strictEqual(U.evaluate(m, prev, rel + 20 * 86400e3).state, 'required');
});
t('privacy: the update check sends no user data (static check of update.js)', () => {
  const s = read('web/js/update.js');
  assert.ok(!/method:\s*'POST'/.test(s) && !/multipart/.test(s) && !/body:/.test(s.replace(/r\.body/g, '')));
  assert.ok(!/VS\.state\.(apps|bills|activity|notes)/.test(s) && !/aadhaar|otp/i.test(s));
});
console.log(n + ' update tests passed');
