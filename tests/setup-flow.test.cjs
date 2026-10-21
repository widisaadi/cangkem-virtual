const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettings } = require('../app/settings.cjs');
const { createSetupFlow } = require('../app/setup-flow.cjs');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-setup-flow-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const crypto = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value), decryptString: value => value.toString() };
  return { directory, store: createSettings(directory, crypto), crypto };
}
test('installer starts new users at Groq and resumes unfinished setup', t => {
  const { store, directory, crypto } = fixture(t);
  const flow = createSetupFlow(store);
  flow.start();
  assert.equal(flow.step(), 'connect');
  assert.equal(flow.fromInstaller(), true);
  assert.throws(() => flow.move('trial'), /API key/);
  store.saveKey('gsk_cawalTestKey000000000000');
  flow.move('shortcut');
  assert.equal(createSettings(directory, crypto).onboarding(), 'shortcut');
  const restarted = createSetupFlow(createSettings(directory, crypto));
  restarted.start();
  assert.equal(restarted.step(), 'shortcut');
  restarted.move('complete');
  assert.equal(restarted.fromInstaller(), false);
});
test('existing users review setup without changing saved completion, keys, or preferences', t => {
  const { store, directory, crypto } = fixture(t);
  store.saveKey('gsk_cawalTestKey000000000000');
  store.setOnboarding('complete');
  const file = path.join(directory, 'settings.json');
  const before = fs.readFileSync(file, 'utf8');
  const flow = createSetupFlow(store);
  flow.start();
  assert.equal(flow.step(), 'connect');
  for (const step of ['shortcut', 'trial', 'ready', 'complete']) flow.move(step);
  assert.equal(flow.fromInstaller(), false);
  assert.equal(flow.step(), 'complete');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const reopened = createSetupFlow(createSettings(directory, crypto));
  assert.equal(reopened.step(), 'complete');
  assert.equal(reopened.fromInstaller(), false);
});
