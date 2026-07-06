const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const repoDir = 'D:\\Car Rental - App';
const lockFile = path.join(repoDir, '.git', 'index.lock');
const logLines = [];
const log = (msg) => { logLines.push(msg); };

log('=== unlock3.js ===');

// Check and remove lock
log('Lock exists: ' + fs.existsSync(lockFile));
if (fs.existsSync(lockFile)) {
  try { fs.unlinkSync(lockFile); log('Lock deleted'); } catch(e) { log('Delete failed: ' + e.message); }
}

// Find git
const gitPaths = [
  'C:\\Program Files\\Git\\bin\\git.exe',
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files (x86)\\Git\\bin\\git.exe',
];
let gitExe = null;
for (const p of gitPaths) {
  if (fs.existsSync(p)) { gitExe = p; log('Git found: ' + p); break; }
}
if (!gitExe) {
  // Try where
  try {
    const w = execSync('where git', { encoding: 'utf8' });
    gitExe = w.trim().split('\n')[0].trim();
    log('Git from where: ' + gitExe);
  } catch(e) { log('where git failed: ' + e.message); }
}

if (!gitExe) { log('NO GIT FOUND'); fs.writeFileSync(path.join(repoDir, 'unlock3-log.txt'), logLines.join('\n')); process.exit(1); }

// git add
const files = [
  'app/(dashboard)/approvals/page.tsx',
  'app/(dashboard)/bookings/page.tsx',
  'app/api/approvals/route.ts',
  'app/api/bookings/[id]/route.ts',
  'app/api/bookings/route.ts',
  'components/bookings/BookingsClient.tsx',
];
log('Running git add...');
const addR = spawnSync(gitExe, ['add', ...files], { cwd: repoDir, encoding: 'utf8' });
log('git add stdout: ' + addR.stdout);
log('git add stderr: ' + addR.stderr);
log('git add status: ' + addR.status);

// Remove lock again before commit
if (fs.existsSync(lockFile)) { try { fs.unlinkSync(lockFile); log('Lock removed after add'); } catch(e) { log('Lock remove after add failed: ' + e.message); } }

// git commit
log('Running git commit...');
const commitR = spawnSync(gitExe, ['commit', '-m', 'fix: remove email from profiles joins (column does not exist in profiles table)'], { cwd: repoDir, encoding: 'utf8' });
log('git commit stdout: ' + commitR.stdout);
log('git commit stderr: ' + commitR.stderr);
log('git commit status: ' + commitR.status);

// Remove lock before push
if (fs.existsSync(lockFile)) { try { fs.unlinkSync(lockFile); log('Lock removed after commit'); } catch(e) { log('Lock remove after commit failed: ' + e.message); } }

// git push
log('Running git push...');
const pushR = spawnSync(gitExe, ['push'], { cwd: repoDir, encoding: 'utf8', timeout: 30000 });
log('git push stdout: ' + pushR.stdout);
log('git push stderr: ' + pushR.stderr);
log('git push status: ' + pushR.status);

log('=== DONE ===');
fs.writeFileSync(path.join(repoDir, 'unlock3-log.txt'), logLines.join('\n'));
