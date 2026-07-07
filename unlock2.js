const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const log = [];
const out = (msg) => { log.push(msg); process.stdout.write(msg + '\n'); };

const repoDir = 'D:\\Car Rental - App';
const lockFile = path.join(repoDir, '.git', 'index.lock');

out('Script started');
out('Checking lock: ' + lockFile);
out('Lock exists (existsSync): ' + fs.existsSync(lockFile));

try {
  const files = fs.readdirSync(path.join(repoDir, '.git'));
  out('Files in .git: ' + files.join(', '));
} catch(e) {
  out('Error reading .git dir: ' + e.message);
}

try {
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
    out('Lock removed');
  } else {
    out('No lock file - trying direct unlink anyway');
    try { fs.unlinkSync(lockFile); out('Direct unlink worked!'); } catch(e2) { out('Direct unlink failed: ' + e2.message); }
  }
} catch (e) {
  out('Error removing lock: ' + e.message);
}

try {
  const r = execSync('git status --short', { cwd: repoDir, encoding: 'utf8', stdio: 'pipe' });
  out('git status: ' + r.substring(0, 200));
} catch(e) {
  out('git status error: ' + (e.stderr || e.message));
}

fs.writeFileSync(path.join(repoDir, 'unlock-log.txt'), log.join('\n') + '\n');
out('Log written to unlock-log.txt');
