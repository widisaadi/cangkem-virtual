const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
function parseCapture(stdout) {
  const [windowLine, displayLine] = stdout.trim().split(/\r?\n/);
  const match = windowLine.match(/^([0-9A-F]+) (\d+) (.+)$/i);
  if (!match) return null;
  const [, handle, pid, name] = match;
  const display = displayLine?.match(/^DISPLAY (-?\d+) (-?\d+)$/);
  return { handle, pid, name, displayPoint: display ? { x: Number(display[1]), y: Number(display[2]) } : null };
}
function createPaste({ app, clipboard, ownWindows, onTargetDisplay = () => {} }) {
  const binary = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'resources'), 'bin', 'cawal-paste.exe');
  return {
    async captureTarget() {
      const { stdout } = await run(binary, ['capture'], { windowsHide: true, timeout: 4000 });
      const captured = parseCapture(stdout);
      if (!captured) return null;
      const { handle, pid, name, displayPoint } = captured;
      if (displayPoint) onTargetDisplay(displayPoint);
      const value = BigInt(`0x${handle}`);
      if (Number(pid) === process.pid || /^(cawal|electron)$/i.test(name)) return null;
      if (ownWindows().some(window => {
        const bytes = window.getNativeWindowHandle();
        return (bytes.length >= 8 ? bytes.readBigUInt64LE() : BigInt(bytes.readUInt32LE())) === value;
      })) return null;
      return { handle, pid };
    },
    async deliver(text, target) {
      clipboard.writeText(text);
      if (!target) return { pasted: false, copied: true, message: 'Tersalin. Tekan Ctrl+V di aplikasi tujuan.' };
      try {
        await run(binary, ['paste', target.handle, target.pid], { windowsHide: true, timeout: 5000 });
        return { pasted: true, copied: true, message: 'Dikirim ke aplikasi tujuan. Hasil juga tersedia di clipboard.' };
      } catch {
        return { pasted: false, copied: true, message: 'Paste otomatis belum berhasil. Tekan Ctrl+V di aplikasi tujuan.' };
      }
    },
  };
}
module.exports = { createPaste, parseCapture };
