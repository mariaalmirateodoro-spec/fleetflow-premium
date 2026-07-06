const { spawnSync } = require('child_process');
const fs = require('fs');
const repoDir = 'D:\\Car Rental - App';
const log = [];
const L = msg => { log.push(String(msg)); };

// Find vercel
const vercelPaths = [
  'C:\\Program Files\\nodejs\\vercel.cmd',
  'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\vercel.cmd',
  'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\vercel',
];
let vercel = null;
for (const p of vercelPaths) {
  if (fs.existsSync(p)) { vercel = p; L('Vercel: ' + p); break; }
}
if (!vercel) {
  // try npx
  vercel = 'npx';
  L('Using npx vercel');
}

const git = 'C:\\Program Files\\Git\\bin\\git.exe';
const r = spawnSync(git, ['log', '--oneline', '-3'], { cwd: repoDir, encoding: 'utf8' });
L('Recent commits:\n' + r.stdout);

// Check vercel status
const vr = spawnSync(vercel === 'npx' ? 'C:\\Program Files\\nodejs\\npx.cmd' : vercel, 
  vercel === 'npx' ? ['vercel', 'ls', '--token', process.env.VERCEL_TOKEN || ''] : ['ls'],
  { cwd: repoDir, encoding: 'utf8', env: { ...process.env, PATH: process.env.PATH + ';C:\\Program Files\\nodejs' } });
L('vercel ls stdout: ' + vr.stdout);
L('vercel ls stderr: ' + vr.stderr);

fs.writeFileSync(repoDir + '\\check-deploy-log.txt', log.join('\n'));
