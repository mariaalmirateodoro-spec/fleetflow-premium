const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoDir = 'D:\\Car Rental - App';
const lockFile = path.join(repoDir, '.git', 'index.lock');

try {
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
    console.log('Lock file removed');
  } else {
    console.log('No lock file');
  }
} catch (e) {
  console.log('Could not remove lock:', e.message);
}

const files = [
  'app/(dashboard)/approvals/page.tsx',
  'app/(dashboard)/bookings/page.tsx',
  'app/api/approvals/route.ts',
  'app/api/bookings/[id]/route.ts',
  'app/api/bookings/route.ts',
  'components/bookings/BookingsClient.tsx',
];

try {
  const addResult = execSync(`git add ${files.map(f => `"${f}"`).join(' ')}`, { cwd: repoDir, encoding: 'utf8' });
  console.log('git add OK:', addResult);
} catch (e) {
  console.log('git add error:', e.stderr || e.message);
}

try {
  const commitResult = execSync('git commit -m "fix: remove email from profiles joins (column does not exist in profiles table)"', { cwd: repoDir, encoding: 'utf8' });
  console.log('git commit OK:', commitResult);
} catch (e) {
  console.log('git commit error:', e.stderr || e.message);
}

try {
  const pushResult = execSync('git push', { cwd: repoDir, encoding: 'utf8' });
  console.log('git push OK:', pushResult);
} catch (e) {
  console.log('git push error:', e.stderr || e.message);
}

console.log('DONE');
