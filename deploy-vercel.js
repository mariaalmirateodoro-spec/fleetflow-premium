const { execFileSync } = require('child_process');
const fs = require('fs');
const logPath = 'D:\\Car Rental - App\\deploy-vercel-log.txt';
fs.writeFileSync(logPath, 'start\n');
const L = s => fs.appendFileSync(logPath, s + '\n');

const vercelBin = 'C:\\Program Files\\nodejs\\node_modules\\.bin\\vercel';
const vercelCmd = vercelBin + '.cmd';
const vercelJs = 'C:\\Program Files\\nodejs\\node_modules\\vercel\\dist\\index.js';

L('vercel bin exists: ' + fs.existsSync(vercelBin));
L('vercel cmd exists: ' + fs.existsSync(vercelCmd));
L('vercel js exists: ' + fs.existsSync(vercelJs));

// Check node_modules
try {
  const mods = fs.readdirSync('C:\\Program Files\\nodejs\\node_modules');
  L('node_modules: ' + mods.join(', '));
} catch(e) { L('node_modules err: ' + e.message); }

// If vercel.cmd exists, use it via node + bash
const bash = 'C:\\Program Files\\Git\\bin\\bash.exe';

// Try running vercel via node directly if the js exists
if (fs.existsSync(vercelJs)) {
  L('Running vercel via node...');
  try {
    const r = execFileSync('C:\\Program Files\\nodejs\\node.exe', [vercelJs, 'deploy', '--prod', '--yes'], {
      cwd: 'D:\\Car Rental - App',
      encoding: 'utf8',
      timeout: 180000,
    });
    L('Output: ' + r);
  } catch(e) {
    L('Error: ' + e.message);
    L('Stdout: ' + (e.stdout || ''));
    L('Stderr: ' + (e.stderr || ''));
  }
} else {
  // Try npx with explicit version
  L('Trying npx vercel@latest...');
  const script = `#!/bin/bash
export PATH="/c/Program Files/nodejs:/c/Program Files/Git/bin:$PATH"
export HOME="/c/Users/PGIAlmira"
cd "/d/Car Rental - App"
echo "node version: $(node --version)"
echo "npx version: $(npx --version)"
npx --yes vercel@latest deploy --prod --yes 2>&1
echo "EXIT: $?"
`;
  fs.writeFileSync('D:\\Car Rental - App\\deploy-npx.sh', script);
  try {
    const r = execFileSync(bash, ['D:\\Car Rental - App\\deploy-npx.sh'], {
      encoding: 'utf8',
      timeout: 180000,
      env: { ...process.env, HOME: process.env.USERPROFILE }
    });
    L('Output: ' + r);
  } catch(e) {
    L('Error: ' + e.message);
    L('Stdout: ' + (e.stdout || ''));
    L('Stderr: ' + (e.stderr || ''));
  }
}
L('done');
