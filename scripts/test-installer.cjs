const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { version } = require('../package.json');
const root = path.resolve(__dirname, '..');
const executable = path.join(root, 'dist', 'releases', version, 'Cawal-Setup-' + version + '.exe');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
for (const page of ['welcome', 'location', 'installing', 'complete', 'flow']) {
  const screenshot = path.join(output, 'installer-' + page + '.png');
  const failure = screenshot + '.error.txt';
  if (fs.existsSync(failure)) fs.unlinkSync(failure);
  execFileSync(executable, ['--preview=' + screenshot, '--page=' + page], { windowsHide: true, timeout: 20000 });
  assert.equal(fs.existsSync(failure), false, 'Installer preview failed: ' + page);
  assert.deepEqual(fs.readFileSync(screenshot).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  console.log('PASS: custom installer ' + page);
}
// Invalid silent destinations must fail before extracting or launching NSIS.
const invalid = require('node:child_process').spawnSync(executable, ['/S', '/D=C:\\'], { windowsHide: true, timeout: 10000 });
assert.equal(invalid.status, 1, 'A drive root cannot be an installation directory');
console.log('PASS: invalid silent install path rejected');
