// Copies the shared UI (../web) into ./web before packaging.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', 'web'), dst = path.join(__dirname, 'web');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('web copied ->', dst);
// Desktop version (package.json) can be ahead of the shared UI when only the Windows app changes: show the real one.
const ver = require('./package.json').version, appjs = path.join(dst, 'js', 'app.js');
fs.writeFileSync(appjs, fs.readFileSync(appjs, 'utf8').replace(/var VERSION = '[0-9.]+';/, "var VERSION = '" + ver + "';"));
