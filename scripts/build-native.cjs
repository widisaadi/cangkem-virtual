const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
if (process.platform !== 'win32') throw new Error('Cawal versi ini ditujukan untuk Windows.');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'native', 'Paste.cs');
const output = path.join(root, 'resources', 'bin', 'cawal-paste.exe');
const compiler = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
if (!fs.existsSync(compiler)) throw new Error('Compiler .NET Framework Windows tidak tersedia. Aktifkan .NET Framework 4.x.');
fs.mkdirSync(path.dirname(output), { recursive: true });
if (!fs.existsSync(output) || fs.statSync(source).mtimeMs > fs.statSync(output).mtimeMs) {
  execFileSync(compiler, ['/nologo', '/optimize+', '/platform:x64', '/target:exe', `/out:${output}`, source], { stdio: 'inherit', windowsHide: true });
}
console.log('Cawal: Windows paste helper siap.');
