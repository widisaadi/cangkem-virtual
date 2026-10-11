const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeShortcut, electronAccelerator } = require('../app/shortcuts.cjs');
const { validateSettings } = require('../app/config.cjs');
test('custom combinations are normalized and accepted by settings', () => {
  assert.equal(normalizeShortcut('Shift+Ctrl+K'), 'CommandOrControl+Shift+K');
  assert.equal(validateSettings({ hotkey: 'Alt+Shift+F9' }).hotkey, 'Alt+Shift+F9');
  assert.equal(normalizeShortcut('Win+Z'), 'Super+Z');
  assert.equal(normalizeShortcut('F8'), 'F8');
  assert.equal(electronAccelerator('CommandOrControl+Semicolon'), 'CommandOrControl+;');
});
test('typing keys, malformed shortcuts, Escape, and paste shortcuts are rejected', () => {
  for (const value of ['K', 'Shift+A', 'Escape', 'Ctrl+V', 'Ctrl+Shift+V', 'Ctrl+Ctrl+K', 'Ctrl+Alt', 'Alt+F4', 'Win+L', 'Ctrl+Alt+Delete', 'Ctrl+K+L', 'Ctrl+F25', 'Ctrl++', '', null]) {
    assert.throws(() => normalizeShortcut(value), undefined, String(value));
  }
});
