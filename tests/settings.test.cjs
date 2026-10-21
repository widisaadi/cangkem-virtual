const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSettings } = require('../app/settings.cjs');
const KEY = 'gsk_cawalTestKey000000000000';
const crypto = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from('encrypted:' + value.split('').reverse().join('')), decryptString: value => value.toString().slice(10).split('').reverse().join('') };
test('only encrypted keys persist and settings survive restart', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createSettings(dir, crypto);
  store.saveKey(KEY); store.write({ ...store.read(), cleanup: false });
  const saved = fs.readFileSync(path.join(dir, 'settings.json'), 'utf8');
  assert.equal(saved.includes(KEY), false);
  const reopened = createSettings(dir, crypto);
  assert.equal(reopened.getKey(), KEY); assert.equal(reopened.read().cleanup, false);
  reopened.removeKey(); assert.equal(reopened.hasKey(), false);
});
test('unavailable encryption fails closed without writing a key', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createSettings(dir, { ...crypto, isEncryptionAvailable: () => false });
  assert.throws(() => store.saveKey(KEY), /Windows secure storage/);
  assert.equal(fs.existsSync(path.join(dir, 'settings.json')), false);
});
test('legacy editions return to default Indonesian-English without losing existing keys or preferences', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-language-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'settings.json');
  for (const language of ['auto', 'en', 'ms', 'jv', 'su', 'id']) {
    fs.writeFileSync(file, JSON.stringify({ settings: { language, model: 'whisper-large-v3', cleanup: false, hotkey: 'Ctrl+Shift+K', microphone: 'chosen-mic' }, key: crypto.encryptString(KEY).toString('base64') }));
    const store = createSettings(dir, crypto);
    assert.equal(store.read().language, 'id');
    assert.equal(store.read().cirebon, false);
    assert.equal(store.read().model, 'whisper-large-v3');
    assert.equal(store.read().cleanup, false);
    assert.equal(store.read().hotkey, 'CommandOrControl+Shift+K');
    assert.equal(store.read().microphone, 'chosen-mic');
    assert.equal(store.getKey(), KEY);
    assert.equal(store.warning, '');
    store.write(store.read());
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).settings.language, 'id');
  }
});

test('Cirebon opt-in persists across restart and can be disabled independently', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-cirebon-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createSettings(dir, crypto);
  store.saveKey(KEY);
  store.write({ ...store.read(), cirebon: true });
  const reopened = createSettings(dir, crypto);
  assert.equal(reopened.read().cirebon, true);
  assert.equal(reopened.read().language, 'auto');
  reopened.write({ ...reopened.read(), cirebon: false });
  assert.equal(reopened.read().language, 'id');
  assert.equal(reopened.getKey(), KEY);
  assert.throws(() => reopened.write({ ...reopened.read(), cirebon: 'true' }));
});
test('corrupt settings surface a warning without exposing stored content', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'settings.json'), '{ invalid');
  const store = createSettings(dir, crypto);
  assert.match(store.warning, /could not be read/);
  assert.equal(store.hasKey(), false);
});

test('new setup resumes its saved step and requires a key before shortcut setup', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-onboarding-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createSettings(dir, crypto);
  assert.equal(store.onboarding(), 'welcome');
  assert.throws(() => store.setOnboarding('trial'), /API key/);
  assert.throws(() => store.setOnboarding('unknown'), /Invalid setup/);
  store.setOnboarding('connect');
  store.saveKey(KEY);
  assert.equal(createSettings(dir, crypto).onboarding(), 'connect', 'saving a key must not skip unfinished setup');
  store.setOnboarding('shortcut');
  assert.equal(createSettings(dir, crypto).onboarding(), 'shortcut');
  store.setOnboarding('complete');
  assert.equal(createSettings(dir, crypto).onboarding(), 'complete');
  assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8').includes(KEY), false);
});

test('existing users with a legacy stored key bypass onboarding without changing their settings', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-existing-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'settings.json');
  const key = crypto.encryptString(KEY).toString('base64');
  fs.writeFileSync(file, JSON.stringify({ settings: { hotkey: 'Alt+1', autoStart: true }, key }));
  const store = createSettings(dir, crypto);
  assert.equal(store.onboarding(), 'complete');
  assert.equal(store.read().hotkey, 'Alt+1');
  assert.equal(store.read().autoStart, true);
  assert.equal(store.getKey(), KEY);
  store.write(store.read());
  store.removeKey();
  assert.equal(createSettings(dir, crypto).onboarding(), 'complete', 'removing a key does not restart onboarding');
});
