const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { version } = require('../package.json');
execFileSync(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'), '--win', 'nsis',
  '--config.directories.output=dist/releases/' + version,
  '--config.artifactName=Cawal-engine-' + version + '.exe'], { stdio: 'inherit', cwd: path.resolve(__dirname, '..'), windowsHide: true });
require('./build-installer.cjs');
