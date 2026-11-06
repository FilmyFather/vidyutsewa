#!/usr/bin/env node
// Generates CHANGELOG.md and release notes from the ONE shared source (web/js/changelog.js).
//   node tools/gen-changelog.js            -> writes CHANGELOG.md
//   node tools/gen-changelog.js notes 1.1.3 -> prints the GitHub release notes for that version
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'web', 'js', 'changelog.js'), 'utf8');
const win = {}; vm.runInNewContext(src, { window: win });
const CL = win.VS_CHANGELOG;
const ent = (e) => `## ${e.v} (${e.date})\n\n` + e.items.map((i) => `- ${i}`).join('\n') + '\n';
if (process.argv[2] === 'notes') {
  const e = CL.find((x) => x.v === process.argv[3]); if (!e) { console.error('no such version'); process.exit(1); }
  console.log(`VidyutSewa By Yuvraj ${e.v}\n\nWhat's New\n` + e.items.map((i) => `- ${i}`).join('\n'));
} else {
  fs.writeFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), '# Changelog\n\nGenerated from web/js/changelog.js (the same text the app shows in What\'s New). Newest first.\n\n' + CL.map(ent).join('\n'));
  console.log('CHANGELOG.md written,', CL.length, 'versions');
}
