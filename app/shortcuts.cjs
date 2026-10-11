const MODIFIERS = ['CommandOrControl', 'Alt', 'Shift', 'Super'];
const ALIASES = { Ctrl: 'CommandOrControl', Control: 'CommandOrControl', CmdOrCtrl: 'CommandOrControl', Win: 'Super', Meta: 'Super' };
const KEYS = /^(?:[A-Z0-9]|F(?:[1-9]|1\d|2[0-4])|Space|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Backspace|Enter|Tab|Minus|Equal|Comma|Period|Slash|Backslash|Semicolon|Quote|BracketLeft|BracketRight|Backquote)$/;
const PUNCTUATION = { Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`' };
function normalizeShortcut(value) {
  if (typeof value !== 'string' || value.length > 120) throw new Error('Shortcut tidak valid.');
  const parts = value.split('+').map(part => part.trim()).map(part => ALIASES[part] || part);
  const key = parts.pop();
  if (!key || !KEYS.test(key) || parts.some(part => !MODIFIERS.includes(part)) || new Set(parts).size !== parts.length) {
    throw new Error('Gunakan kombinasi Ctrl, Alt, Shift, atau Win dengan satu tombol.');
  }
  if (!parts.some(part => part !== 'Shift') && !/^F\d+$/.test(key)) {
    throw new Error('Tambahkan Ctrl, Alt, atau Win agar shortcut tidak mengganggu pengetikan.');
  }
  const normalized = [...MODIFIERS.filter(modifier => parts.includes(modifier)), key].join('+');
  const reserved = new Set(['Alt+F4', 'Super+L', 'CommandOrControl+Alt+Delete', 'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X', 'CommandOrControl+Shift+V']);
  if (reserved.has(normalized)) throw new Error('Kombinasi ini dipakai Windows atau salin/tempel. Pilih shortcut lain.');
  return normalized;
}
function electronAccelerator(value) {
  return value.split('+').map(part => PUNCTUATION[part] || part).join('+');
}
module.exports = { normalizeShortcut, electronAccelerator };
