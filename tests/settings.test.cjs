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
  assert.throws(() => store.saveKey(KEY), /aman Windows/);
  assert.equal(fs.existsSync(path.join(dir, 'settings.json')), false);
});
test('legacy language settings become Indonesian without losing the key or preferences', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-language-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'settings.json');
  for (const language of ['auto', 'en', 'ms', 'jv', 'su', 'id']) {
    fs.writeFileSync(file, JSON.stringify({ settings: { language, model: 'whisper-large-v3', cleanup: false, hotkey: 'Ctrl+Shift+K', microphone: 'chosen-mic' }, key: crypto.encryptString(KEY).toString('base64') }));
    const store = createSettings(dir, crypto);
    assert.equal(store.read().language, 'id');
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
test('corrupt settings surface a warning without exposing stored content', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-settings-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'settings.json'), '{ invalid');
  const store = createSettings(dir, crypto);
  assert.match(store.warning, /tidak dapat dibaca/);
  assert.equal(store.hasKey(), false);
});
