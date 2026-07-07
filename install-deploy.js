const { execSync } = require('child_process');
const fs = require('fs');
const logPath = 'D:\\Car Rental - App\\install-deploy-log.txt';
fs.writeFileSync(logPath, 'start\n');
const L = s => { fs.appendFileSync(logPath, s + '\n'); };

const opts = { cwd: 'D:\\Car Rental - App', encoding: 'utf8', timeout: 120000, shell: true };

// Install vercel globally using shell:true (fixes EINVAL for .cmd files)
L('Installing vercel globally...');
try {
  const r = execSync('"C:\\Program Files\\nodejs\\npm.cmd" install -g vercel', opts);
  L('install ok: ' + r.substring(0, 300));
} catch(e) {
  L('install err: ' + e.message);
  L('stderr: ' + (e.stderr || ''));
  L('stdout: ' + (e.stdout || ''));
}

// Check if installed now
const vercelCmd = 'C:\\Program Files\\nodejs\\node_modules\\.bin\\vercel.cmd';
L('vercel.cmd exists now: ' + fs.existsSync(vercelCmd));

// Try deploying
L('Deploying...');
try {
  const r2 = execSync('"C:\\Program Files\\nodejs\\node_modules\\.bin\\vercel" deploy --prod --yes', { ...opts, timeout: 180000 });
  L('deploy ok: ' + r2.substring(0, 500));
} catch(e) {
  L('deploy err: ' + e.message);
  L('stderr: ' + (e.stderr || ''));
  L('stdout: ' + (e.stdout || ''));
}

L('done');
