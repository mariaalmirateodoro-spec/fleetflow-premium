const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const repoDir = 'D:\\Car Rental - App';
const logPath = repoDir + '\\find-deploy-log.txt';

// Write immediately so we know script ran
fs.writeFileSync(logPath, 'Script started\n');
const L = msg => { fs.appendFileSync(logPath, String(msg) + '\n'); };

// Find npm global bin directory
const npmResult = spawnSync('C:\\Program Files\\nodejs\\npm.cmd', ['config', 'get', 'prefix'], { encoding: 'utf8' });
L('npm prefix: ' + npmResult.stdout.trim());
const npmPrefix = npmResult.stdout.trim();

// Check for vercel in common locations
const checks = [
  npmPrefix + '\\vercel.cmd',
  npmPrefix + '\\vercel',
  'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\vercel.cmd',
  'C:\\ProgramData\\npm\\vercel.cmd',
];

let vercelCmd = null;
for (const c of checks) {
  L('Checking: ' + c + ' -> ' + fs.existsSync(c));
  if (fs.existsSync(c)) { vercelCmd = c; break; }
}

// List npm bin dir
if (npmPrefix) {
  try {
    const files = fs.readdirSync(npmPrefix).filter(f => f.includes('vercel'));
    L('Vercel files in npm prefix: ' + files.join(', '));
  } catch(e) { L('readdir error: ' + e.message); }
}

L('Vercel cmd: ' + vercelCmd);

if (vercelCmd) {
  L('Running vercel deploy --prod...');
  const r = spawnSync(vercelCmd, ['deploy', '--prod', '--yes'], {
    cwd: repoDir,
    encoding: 'utf8',
    timeout: 180000,
    windowsVerbatimArguments: false,
  });
  L('stdout: ' + r.stdout);
  L('stderr: ' + r.stderr);
  L('status: ' + r.status);
  if (r.error) L('error: ' + r.error.message);
} else {
  L('ERROR: vercel not found. Trying git status to confirm push worked...');
  const git = 'C:\\Program Files\\Git\\bin\\git.exe';
  const gr = spawnSync(git, ['log', '--oneline', '-3'], { cwd: repoDir, encoding: 'utf8' });
  L('git log: ' + gr.stdout);
}

L('Done.');
