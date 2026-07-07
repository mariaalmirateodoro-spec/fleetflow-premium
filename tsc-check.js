const { spawnSync } = require('child_process');
const fs = require('fs');

const cwd = 'D:\\Car Rental - App';
const node = 'C:\\Program Files\\nodejs\\node.exe';

// Run tsc via node directly using the tsc JS file
const tscJs = cwd + '\\node_modules\\typescript\\bin\\tsc';

const r = spawnSync(
  node,
  [tscJs, '--noEmit'],
  {
    cwd,
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env },
  }
);

const out = (r.stdout || '') + (r.stderr || '');
fs.writeFileSync(cwd + '\\tsc-output.txt', out || '(no output — exit 0, no errors)\n');
fs.appendFileSync(cwd + '\\tsc-output.txt', '\nexit code: ' + r.status);
if (r.error) fs.appendFileSync(cwd + '\\tsc-output.txt', '\nerror: ' + r.error.message);
