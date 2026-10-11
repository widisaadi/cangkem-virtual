const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_SETTINGS, validateSettings, validateKey } = require('./config.cjs');

function createSettings(directory, crypto) {
  const file = path.join(directory, 'settings.json');
  let data = { settings: { ...DEFAULT_SETTINGS }, key: '' };
  let warning = '';
  try {
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      data = { settings: validateSettings(saved.settings), key: typeof saved.key === 'string' ? saved.key : '' };
    }
  } catch {
    warning = 'Pengaturan tidak dapat dibaca. Atur ulang preferensi Cawal dan API key Groq.';
  }
  const persist = (next) => {
    fs.mkdirSync(directory, { recursive: true });
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
    data = next;
  };
  return {
    get warning() { return warning; },
    read: () => ({ ...data.settings }),
    write: (settings) => { persist({ ...data, settings: validateSettings(settings) }); },
    hasKey: () => Boolean(data.key),
    getKey: () => {
      if (!data.key) throw new Error('Simpan API key Groq terlebih dahulu.');
      try { return crypto.decryptString(Buffer.from(data.key, 'base64')); }
      catch { throw new Error('API key tidak dapat dibuka di perangkat ini. Simpan ulang key Groq.'); }
    },
    saveKey: (key) => {
      const value = validateKey(key);
      if (!crypto.isEncryptionAvailable()) throw new Error('Penyimpanan aman Windows belum tersedia. Coba mulai ulang Cawal.');
      persist({ ...data, key: crypto.encryptString(value).toString('base64') });
    },
    removeKey: () => persist({ ...data, key: '' }),
  };
}
module.exports = { createSettings };
