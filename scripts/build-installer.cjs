const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

if (process.platform !== 'win32') throw new Error('The custom installer must be built on Windows.');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const output = path.join(root, 'dist', 'releases', version);
const staging = path.join(root, 'build', 'installer');
const payload = path.join(output, 'Cawal-Setup-' + version + '.exe');
const bundled = path.join(staging, 'Cawal-engine-' + version + '.exe');
const engine = path.join(output, 'Cawal-engine-' + version + '.exe');
fs.mkdirSync(staging, { recursive: true });
if (!fs.existsSync(engine) && !fs.existsSync(bundled)) throw new Error('Build the NSIS installation engine first.');
// Keep the engine available for recovery, and embed an immutable copy in Setup.
if (fs.existsSync(engine)) fs.copyFileSync(engine, bundled);
fs.writeFileSync(path.join(staging, 'version.txt'), version);
fs.writeFileSync(path.join(staging, 'AssemblyInfo.cs'), [
  'using System.Reflection;',
  '[assembly: AssemblyTitle("Cawal Setup")]',
  '[assembly: AssemblyProduct("Cawal Setup")]',
  '[assembly: AssemblyCompany("Cawal")]',
  '[assembly: AssemblyVersion("' + version + '.0")]',
  '[assembly: AssemblyFileVersion("' + version + '.0")]'
].join('\n'));
fs.writeFileSync(path.join(staging, 'sha256.txt'), createHash('sha256').update(fs.readFileSync(bundled)).digest('hex'));
const framework = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319');
const refs = ['System.dll', 'System.Core.dll', 'System.Xaml.dll', 'WindowsBase.dll', 'PresentationCore.dll', 'PresentationFramework.dll'];
const args = ['/nologo', '/optimize+', '/platform:x64', '/target:winexe', '/out:' + payload,
  '/win32icon:' + path.join(root, 'resources', 'icon.ico'),
  '/resource:' + bundled + ',setup.payload',
  '/resource:' + path.join(root, 'resources', 'logo.png') + ',setup.logo',
  '/resource:' + path.join(root, 'LICENSE') + ',setup.license',
  '/resource:' + path.join(staging, 'version.txt') + ',setup.version',
  '/resource:' + path.join(staging, 'sha256.txt') + ',setup.sha256',
  '/r:' + path.join(framework, 'System.Windows.Forms.dll'),
  ...refs.map(name => '/r:' + path.join(framework, fs.existsSync(path.join(framework, name)) ? name : path.join('WPF', name))),
  path.join(staging, 'AssemblyInfo.cs'), path.join(root, 'native', 'Installer.cs')];
execFileSync(path.join(framework, 'csc.exe'), args, { stdio: 'inherit', windowsHide: true });
// This blockmap belongs to the inner engine, not the branded executable.
const blockmap = payload + '.blockmap';
if (fs.existsSync(blockmap)) fs.unlinkSync(blockmap);
console.log('Custom Cawal Setup: ' + payload);
