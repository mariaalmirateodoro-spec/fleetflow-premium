const { execFileSync } = require('child_process');
const fs = require('fs');
const logPath = 'D:\\Car Rental - App\\find-vercel-log.txt';
fs.writeFileSync(logPath, 'start\n');
const L = s => fs.appendFileSync(logPath, s + '\n');

try {
  const o = execFileSync('C:\\Program Files\\nodejs\\npm.cmd', ['config', 'get', 'prefix'], { encoding: 'utf8' });
  L('prefix: ' + o);
} catch(e) { L('npm err: ' + e.message); }

try {
  const dirs = [
    'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm',
    'C:\\ProgramData\\npm',
    'C:\\Program Files\\nodejs',
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) { L(d + ' -> not found'); continue; }
    const files = fs.readdirSync(d).filter(f => f.toLowerCase().includes('vercel'));
    L(d + ' -> ' + (files.length ? files.join(', ') : 'no vercel'));
  }
} catch(e) { L('dir err: ' + e.message); }

L('done');
