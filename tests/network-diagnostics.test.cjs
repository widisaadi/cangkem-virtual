const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createNetworkDiagnostics } = require('../app/network-diagnostics.cjs');

test('local network diagnostics exclude request content and remain bounded', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-diagnostics-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const report = createNetworkDiagnostics(directory);
  for (let i = 0; i < 400; i++) report({ stage: 'transcription', kind: 'network', networkCode: 'ECONNRESET', elapsedMs: 123, key: 'gsk_secret', audio: 'private audio', text: 'private transcript', headers: 'Bearer secret' });
  const file = path.join(directory, 'network-errors.jsonl');
  const log = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(log, /gsk_|Bearer|private|audio|transcript"/);
  assert.ok(fs.statSync(file).size < 34000);
  const last = JSON.parse(log.trim().split('\n').at(-1));
  assert.equal(last.stage, 'transcription');
  assert.equal(last.networkCode, 'ECONNRESET');
  assert.deepEqual(Object.keys(last).sort(), ['elapsedMs', 'kind', 'networkCode', 'stage', 'time']);
});
