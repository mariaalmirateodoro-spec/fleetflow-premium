const { spawnSync } = require('child_process');
const fs = require('fs');
const repoDir = 'D:\\Car Rental - App';
const log = [];
const L = msg => { log.push(String(msg)); };

const git = 'C:\\Program Files\\Git\\bin\\git.exe';

// Check current git log to confirm our commit is there
const gitLog = spawnSync(git, ['log', '--oneline', '-5'], { cwd: repoDir, encoding: 'utf8' });
L('=== Git log ===\n' + gitLog.stdout);

// Find vercel CLI
const vercelCandidates = [
  'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\vercel.cmd',
  'C:\\Users\\PGIAlmira\\AppData\\Local\\npm\\vercel.cmd', 
  'C:\\Program Files\\nodejs\\vercel.cmd',
];

let vercelCmd = null;
for (const c of vercelCandidates) {
  if (fs.existsSync(c)) { vercelCmd = c; L('Found vercel: ' + c); break; }
}

if (!vercelCmd) {
  // search npm global
  const npmBin = spawnSync('C:\\Program Files\\nodejs\\npm.cmd', ['bin', '-g'], { encoding: 'utf8' });
  L('npm bin -g: ' + npmBin.stdout);
  const binDir = npmBin.stdout.trim();
  const candidate = binDir + '\\vercel.cmd';
  if (fs.existsSync(candidate)) { vercelCmd = candidate; L('Found via npm bin: ' + candidate); }
}

if (!vercelCmd) {
  L('Vercel CLI not found - listing npm global packages');
  const npmList = spawnSync('C:\\Program Files\\nodejs\\npm.cmd', ['list', '-g', '--depth=0'], { encoding: 'utf8' });
  L(npmList.stdout);
} else {
  L('Running vercel deploy --prod...');
  const deploy = spawnSync(vercelCmd, ['deploy', '--prod', '--yes'], { 
    cwd: repoDir, 
    encoding: 'utf8',
    timeout: 120000
  });
  L('STDOUT: ' + deploy.stdout);
  L('STDERR: ' + deploy.stderr);
  L('STATUS: ' + deploy.status);
}

fs.writeFileSync(repoDir + '\\deploy-now-log.txt', log.join('\n'));
L('Done - check deploy-now-log.txt');
