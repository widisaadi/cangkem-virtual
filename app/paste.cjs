const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
function parseCapture(stdout) {
  const [windowLine, ...rest] = stdout.trim().split(/\r?\n/);
  const match = windowLine.match(/^([0-9A-F]+) (\d+) (.+)$/i);
  if (!match) return null;
  const [, handle, pid, name] = match;
  const display = rest.map(line => line.match(/^DISPLAY (-?\d+) (-?\d+)$/)).find(Boolean);
  const image = rest.find(line => line.startsWith('PATH '))?.slice(5) || null;
  return { handle, pid, name, image, displayPoint: display ? { x: Number(display[1]), y: Number(display[2]) } : null };
}
function createPaste({ app, clipboard, ownWindows, onTargetDisplay = () => {}, onTargetApp = () => {} }) {
  const binary = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'resources'), 'bin', 'cawal-paste.exe');
  return {
    async captureTarget() {
      const { stdout } = await run(binary, ['capture'], { windowsHide: true, timeout: 4000 });
      const captured = parseCapture(stdout);
      if (!captured) return null;
      const { handle, pid, name, image, displayPoint } = captured;
      if (displayPoint) onTargetDisplay(displayPoint);
      const value = BigInt(`0x${handle}`);
      if (Number(pid) === process.pid || /^(cawal|electron)$/i.test(name)) return null;
      if (ownWindows().some(window => {
        const bytes = window.getNativeWindowHandle();
        return (bytes.length >= 8 ? bytes.readBigUInt64LE() : BigInt(bytes.readUInt32LE())) === value;
      })) return null;
      if (image) onTargetApp(image);
      return { handle, pid };
    },
    maskMenu() {
      run(binary, ['mask'], { windowsHide: true, timeout: 2000 }).catch(() => {});
    },
    async deliver(text, target) {
      clipboard.writeText(text);
      if (!target) return { pasted: false, copied: true, message: 'Copied. Press Ctrl+V in the target app.' };
      try {
        await run(binary, ['paste', target.handle, target.pid], { windowsHide: true, timeout: 5000 });
        return { pasted: true, copied: true, message: 'Pasted into the target app. The result is also on your clipboard.' };
      } catch {
        return { pasted: false, copied: true, message: 'Automatic paste failed. Press Ctrl+V in the target app.' };
      }
    },
  };
}
module.exports = { createPaste, parseCapture };
