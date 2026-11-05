// Run: node tests/parsers.test.js   (no dependencies)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../web/js/parsers.js');
const fx = (f) => fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('status page: real (anonymised) MSEDCL page parses', () => {
  const r = P.parseStatusPage(fx('status-submitted.html'));
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.applicationId, '12345678');
  assert.strictEqual(r.consumerNo, '001122334455');
  assert.strictEqual(r.oldName, 'PATIL RAMESH SHANKAR');
  assert.strictEqual(r.newName, 'DESHMUKH SUNIL ANANT');
  assert.strictEqual(r.mobile, '9800000000');
  assert.strictEqual(r.applicationDate, '31-Oct-26');
  assert.strictEqual(r.docsUploaded, 2);
  assert.strictEqual(r.rawStatus, 'Application Submitted');
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(r.fee, '130');
  assert.strictEqual(r.receiptNo, '4400000000001');
  assert.strictEqual(r.receiptAmount, '130');
  assert.strictEqual(r.reason, 'Change in Ownership');
  assert.strictEqual(r.hasUploadForm, false);
});
t('status page: empty / not found page', () => {
  const r = P.parseStatusPage('<html><body><form><table id="x"></table></form></body></html>');
  assert.strictEqual(r.found, false);
  assert.strictEqual(P.parseStatusPage('').ok, false);
});
t('status page: variants for approved / rejected / zero docs / upload form', () => {
  const base = fx('status-submitted.html');
  const appr = base.replace('>Application Submitted<', '>Application Approved<');
  assert.strictEqual(P.parseStatusPage(appr).status, 'approved');
  const rej = base.replace('>Application Submitted<', '>Application Rejected - Documents Not Clear<');
  assert.strictEqual(P.parseStatusPage(rej).status, 'rejected');
  const zero = base.replace(/(No of Documents Online Uploaded\. <\/td><td>\s*)2/, '$10')
    .replace('</form>', '<input type="file" name="ctl00$fuDoc1" /><input type="file" name="ctl00$fuDoc2" /><input type="submit" name="btnUploadAll" value="Upload All Documents" /></form>');
  const z = P.parseStatusPage(zero);
  assert.strictEqual(z.docsUploaded, 0);
  assert.deepStrictEqual(z.fileInputs, ['ctl00$fuDoc1', 'ctl00$fuDoc2']);
  assert.deepStrictEqual(P.uploadButton(zero), { name: 'btnUploadAll', value: 'Upload All Documents' });
  const f = P.aspFormFields(zero);
  assert.ok('__VIEWSTATE' in f && '__EVENTVALIDATION' in f);
});
t('classifyStatus wording', () => {
  assert.strictEqual(P.classifyStatus('Application Submitted'), 'pending');
  assert.strictEqual(P.classifyStatus('Documents Uploaded'), 'pending');
  assert.strictEqual(P.classifyStatus('Name Changed Successfully'), 'approved');
  assert.strictEqual(P.classifyStatus('Provisional Certificate Generated'), 'approved');
  assert.strictEqual(P.classifyStatus('Returned To Applicant For Re-Upload'), 'rejected');
  assert.strictEqual(P.classifyStatus('Not Approved'), 'rejected');
  assert.strictEqual(P.classifyStatus(''), 'pending');
});
t('bill: RecentBill JSON', () => {
  const b = P.parseBill(fx('bill-recent.json'));
  assert.strictEqual(b.ok, true);
  assert.strictEqual(b.name, 'RAMESH SHANKAR PATIL');
  assert.strictEqual(b.consumerNo, '001122334455');
  assert.strictEqual(b.billingUnit, '4708');
  assert.strictEqual(b.units, '175');
  assert.strictEqual(b.billMonthLabel, 'Oct 2026');
  assert.strictEqual(b.amount, '1910');
  assert.strictEqual(b.afterDueAmount, '1930');
  assert.strictEqual(b.promptDiscount, '20');
  assert.ok(b.pdfUrl.startsWith('https://billpdf.mahadiscom.in/BD?k='));
});
t('bill: not found + garbage', () => {
  const b = P.parseBill(fx('bill-notfound.json'));
  assert.strictEqual(b.ok, false); assert.strictEqual(b.notFound, true);
  assert.strictEqual(P.parseBill('<html>').ok, false);
  assert.strictEqual(P.parseBill({ responseStatus: 'FAILURE', responseMessage: 'Down' }).ok, false);
});
t('bill urls + months', () => {
  assert.strictEqual(P.billUrl('001122334455'), 'https://mobileapp.mahadiscom.in/App_Requests/RecentBill?cat=LT&cno=001122334455&lookupPaymentsYN=N&lang=en');
  assert.strictEqual(P.billUrl('001122334455', '2609'), 'https://mobileapp.mahadiscom.in/App_Requests/PreviousBill?cat=LT&cno=001122334455&mth=2609');
  assert.deepStrictEqual(P.prevMonths('2602', 3), ['2601', '2512', '2511']);
});
t('application id capture', () => {
  assert.strictEqual(P.findApplicationId('Your Application ID is 87261272. Please upload documents.'), '87261272');
  assert.strictEqual(P.findApplicationId('Application No : 12345678'), '12345678');
  assert.strictEqual(P.findApplicationId('ChangeNameUploadDoc.aspx?applicationno=11223344'), '11223344');
  assert.strictEqual(P.findApplicationId('Consumer No 002233826874'), '');
});
t('file names + slot guessing', () => {
  assert.strictEqual(P.safeFileName('My Agreement (final) #2.pdf'), 'My_Agreement_final_2');
  assert.strictEqual(P.guessSlot('Agmt_ramesh.pdf'), 'agreement');
  assert.strictEqual(P.guessSlot('AGRMT.jpg'), 'agreement');
  assert.strictEqual(P.guessSlot('Sale Agreement.pdf'), 'agreement');
  assert.strictEqual(P.guessSlot('Xform.pdf'), 'formx');
  assert.strictEqual(P.guessSlot('X-Form scan.jpeg'), 'formx');
  assert.strictEqual(P.guessSlot('form_x.pdf'), 'formx');
  assert.strictEqual(P.guessSlot('FormX.pdf'), 'formx');
  assert.strictEqual(P.guessSlot('IMG_2026.jpg'), '');
});
t('whatsapp template', () => {
  assert.strictEqual(P.fillTemplate('Hi {Name}, ID {ID} - {Shop Name}', { name: 'Ramesh', id: '12345678', shopName: 'Yuvi Xerox' }), 'Hi Ramesh, ID 12345678 - Yuvi Xerox');
});
t('misc', () => {
  assert.ok(P.validConsumerNo('001122334455')); assert.ok(!P.validConsumerNo('12345'));
  assert.ok(P.validAppId('12345678')); assert.ok(!P.validAppId('1234567'));
  assert.strictEqual(new Date(P.parseMsedclDate('31-Oct-26')).getDate(), 31);
  assert.ok(P.versionNewer('1.0.1', '1.0')); assert.ok(!P.versionNewer('v1.0.0', '1.0'));
});
t('upload file names: no spaces or special characters', () => {
  assert.strictEqual(P.uploadName('My Agreement (final) #2.PDF'), 'My_Agreement_final_2.pdf');
  assert.strictEqual(P.uploadName('photo 12 & copy.jpeg'), 'photo_12_copy.jpeg');
  assert.strictEqual(P.uploadName('..%%.pdf', 'Doc'), 'Doc.pdf');
  assert.strictEqual(P.uploadName('noext name'), 'noext_name.pdf');
  ['a b.pdf', 'x+y;z`.jpg', "it's \"q\".pdf", 'a/b<c>%.pdf', '\u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c 1.pdf'].forEach((n) => assert.ok(/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(P.uploadName(n)), n + ' -> ' + P.uploadName(n)));
});
t('doc slots: spelling correction = 1 PDF, normal = 2 PDFs', () => {
  assert.deepStrictEqual(P.docSlots('spell'), ['single']);
  assert.deepStrictEqual(P.docSlots('normal'), ['agreement', 'formx']);
  assert.deepStrictEqual(P.docSlots(undefined), ['agreement', 'formx']);
  assert.strictEqual(P.docName('87261272', 'single'), 'SpellingCorrection_87261272.pdf');
  assert.strictEqual(P.docName('87261272', 'formx'), 'FormX_87261272.pdf');
});
t('share text carries the application type', () => {
  assert.strictEqual(P.fillTemplate('ID {ID}\nType: {Type}', { id: '1', type: 'Spelling Correction In Name' }), 'ID 1\nType: Spelling Correction In Name');
});

/* ---------- v1.1.0: New Application flow ---------- */
t('name: Title + First + Middle + Last composed with single spaces', () => {
  assert.strictEqual(P.composeName('Mr', 'Ramesh', '', 'Patil'), 'Mr Ramesh Patil');
  assert.strictEqual(P.composeName('M/S', '  Jai   Laxmi ', ' ', ' Traders '), 'M/S Jai Laxmi Traders');
  assert.strictEqual(P.composeName('', 'Sunil', 'Anant', 'Deshmukh'), 'Sunil Anant Deshmukh');
  assert.strictEqual(P.composeName(null, undefined, '', ''), '');
});
t('name: counter counts the composed name (title and spaces included)', () => {
  assert.strictEqual(P.nameLength('Mr', 'Ramesh', '', 'Patil'), 15);
  assert.strictEqual(P.nameLength('', '', '', ''), 0);
  assert.strictEqual(P.NAME_MAX, 50);
});
t('name: typing is blocked at 50 characters', () => {
  const p = P.clampName({ title: 'M/S', first: 'A'.repeat(80), middle: '', last: '' }, 'first');
  assert.strictEqual(P.composeName(p.title, p.first, p.middle, p.last).length, 50);
  assert.strictEqual(p.first.length, 46);
  // already short: untouched
  const q = P.clampName({ title: 'Mr', first: 'Ramesh', middle: '', last: 'Patil' }, 'last');
  assert.strictEqual(q.last, 'Patil');
  // the field being typed is shortened, the others stay
  const r = P.clampName({ title: 'Mr', first: 'Ramesh', middle: 'Shankar', last: 'B'.repeat(60) }, 'last');
  assert.strictEqual(r.first, 'Ramesh'); assert.strictEqual(r.middle, 'Shankar');
  assert.ok(P.nameLength(r.title, r.first, r.middle, r.last) <= 50);
});
t('email and mobile checks', () => {
  assert.ok(P.validEmail('a.b@example.com')); assert.ok(!P.validEmail('a@b')); assert.ok(!P.validEmail('no at.com'));
  assert.ok(P.validMobile('9876543210')); assert.ok(!P.validMobile('1234567890')); assert.ok(!P.validMobile('98765'));
});
t('application number is read from the confirmation text', () => {
  assert.strictEqual(P.parseAppNo('Your Application ID is 87261272. Please upload documents.'), '87261272');
  assert.strictEqual(P.parseAppNo('Application Number : 12345678'), '12345678');
  assert.strictEqual(P.parseAppNo('Request registered. Application no 55667788 generated'), '55667788');
  assert.strictEqual(P.parseAppNo('nothing here 123'), '');
});
t('fee is read from the page text', () => {
  assert.strictEqual(P.feeFromText('Processing Fee : Rs. 130.00'), 130);
  assert.strictEqual(P.feeFromText('Fee payable \u20B9 180'), 180);
  assert.strictEqual(P.feeFromText('no money here'), 0);
});
t('receipt status: success / pending / failed', () => {
  assert.strictEqual(P.receiptStatus([['Payment Status', 'Success']], ''), 'success');
  assert.strictEqual(P.receiptStatus([['Status', 'Failed']], ''), 'failed');
  assert.strictEqual(P.receiptStatus([['Status', 'Awaited']], ''), 'pending');
  assert.strictEqual(P.receiptStatus([], 'Transaction Status: Successful'), 'success');
  assert.strictEqual(P.receiptStatus([], 'no status'), '');
});
t('aadhaar linked mobile is shown exactly as the site writes it', () => {
  assert.strictEqual(P.aadhaarMobileText('OTP sent to Aadhaar linked mobile 9876543210'), '9876543210');
  assert.strictEqual(P.aadhaarMobileText('OTP sent to mobile XXXXXX3210'), 'XXXXXX3210');
  assert.strictEqual(P.aadhaarMobileText('no number'), '');
});
t('upload file rules: clean names (letters, digits, _ and -), pdf extension', () => {
  const n1 = P.uploadName('My Agreement (final) \u0905.pdf', 'Document', 'pdf');
  assert.ok(/^[A-Za-z0-9_-]+\.pdf$/.test(n1), n1);
  assert.ok(/^[A-Za-z0-9_-]+\.pdf$/.test(P.uploadName('  .pdf', 'Document', 'pdf')));
  assert.strictEqual(P.receiptName('87261272', 'pdf'), 'Receipt_87261272.pdf');
  assert.strictEqual(P.receiptName('87261272', 'jpg'), 'Receipt_87261272.jpg');
  assert.ok(!/\s/.test(P.docName('87261272', 'agreement')));
});
t('versions: 1.1.0 is newer than 1.0.1', () => {
  assert.strictEqual(P.versionNewer('1.1.0', '1.0.1'), true);
  assert.strictEqual(P.versionNewer('1.0.1', '1.1.0'), false);
});

/* ---------- v1.1.1: login page state classifier (fixtures = snapshots in the shape vsdrv.js produces) ---------- */
const snaps = JSON.parse(fx('login-snaps.json'));
const cls = (k) => P.classifyLoginPage(snaps[k], new Array(snaps[k].cons || 0).fill({}), 'login');
t('login: form with the site\'s real error -> login + error "Invalid Captcha", never "Complaint Status"', () => {
  const r = cls('loginFormRealError');
  assert.strictEqual(r.kind, 'login'); assert.deepStrictEqual(r.errors, ['Invalid Captcha']);
});
t('login: form, no error, menu text "Complaint Status" present -> login, NO error', () => {
  const r = cls('loginFormNoError');
  assert.strictEqual(r.kind, 'login'); assert.deepStrictEqual(r.errors, []);
});
t('login: OTP page -> loginotp (OTP box signal)', () => {
  const r = cls('otpPage');
  assert.strictEqual(r.kind, 'loginotp'); assert.ok(r.signals.some((x) => /OTP box/.test(x)));
});
t('login: My Account page (consumer list / Logout / title) -> accounts / home', () => {
  assert.strictEqual(cls('myAccountPage').kind, 'accounts');
  const noCons = Object.assign({}, snaps.myAccountPage, { cons: 0 });
  assert.strictEqual(P.classifyLoginPage(noCons, [], 'login').kind, 'home');
  assert.strictEqual(cls('marathiAccountTitle').kind, 'home');
  assert.deepStrictEqual(cls('myAccountPage').errors, []);
});
t('login: menu text with "Complaint" is never an error (messages, alerts, near-matches)', () => {
  const r = cls('menuTextOnly'); assert.deepStrictEqual(r.errors, []);
  const nav = snaps.menuTextOnly.buttons;
  ['Complaint Status', 'Complaint Registration', 'Online Application Related Complaint Registration', 'complaint status ', 'Register Complaint for Swagat Cell'].forEach((m) => {
    assert.deepStrictEqual(P.cleanErrors([m], nav), [], m); assert.deepStrictEqual(P.cleanErrors([m], nav, true), [], m + ' (trusted)');
  });
  assert.deepStrictEqual(P.cleanErrors([{ t: 'Complaint Status' }], []), []);   // even with no button list: no error words, not an error
  assert.deepStrictEqual(P.cleanErrors(['You have entered wrong OTP!'], nav, true), ['You have entered wrong OTP!']);
  assert.deepStrictEqual(P.cleanErrors(['Some other alert text'], nav, true), ['Some other alert text']);   // alerts raised by the site always count
});
t('login: the site\'s own validation message found in the page text even without a message element', () => {
  const r = cls('siteMessageOnlyInText'); assert.strictEqual(r.kind, 'login'); assert.deepStrictEqual(r.errors, ['Enter Captcha First']);
});
t('login: a page with no password / OTP / account signals is "other", not a login failure', () => {
  const r = P.classifyLoginPage({ url: 'https://x', title: 'Something', text: 'hello', main: 'hello', fields: [], buttons: [], msgs: [] }, [], 'login');
  assert.strictEqual(r.kind, 'other');
});
console.log(`\n${n} tests passed`);
