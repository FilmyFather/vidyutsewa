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
console.log(`\n${n} tests passed`);
