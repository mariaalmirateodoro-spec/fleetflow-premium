const { spawnSync } = require('child_process');
const fs = require('fs');

const cwd = 'D:\\Car Rental - App';
const log = [];
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false, timeout: 30000 });
  log.push(`$ ${cmd} ${args.join(' ')}`);
  if (r.stdout) log.push('stdout: ' + r.stdout.trim());
  if (r.stderr) log.push('stderr: ' + r.stderr.trim());
  log.push('exit: ' + r.status);
  if (r.error) log.push('error: ' + r.error.message);
  return r;
};

// Remove stale lock if it exists
if (fs.existsSync(cwd + '\\.git\\index.lock')) {
  fs.unlinkSync(cwd + '\\.git\\index.lock');
  log.push('Removed index.lock');
}

const git = 'C:\\Program Files\\Git\\bin\\git.exe';

run(git, ['status']);
run(git, ['add', 'app/(dashboard)/bookings/page.tsx']);
run(git, ['commit', '-m', 'fix: select all driver fields to satisfy Driver[] type in bookings page']);
run(git, ['push', 'origin', 'main']);
run(git, ['log', '--oneline', '-5']);

fs.writeFileSync(cwd + '\\git-push-log.txt', log.join('\n'));
