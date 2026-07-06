const { spawnSync } = require('child_process');
const fs = require('fs');

const cwd = 'D:\\Car Rental - App';
const git = 'C:\\Program Files\\Git\\bin\\git.exe';
const log = [];
const run = (args) => {
  const r = spawnSync(git, args, { cwd, encoding: 'utf8', shell: false, timeout: 30000 });
  log.push(`$ git ${args.join(' ')}`);
  if (r.stdout) log.push('stdout: ' + r.stdout.trim());
  if (r.stderr) log.push('stderr: ' + r.stderr.trim());
  log.push('exit: ' + r.status);
  if (r.error) log.push('error: ' + r.error.message);
  return r;
};

run(['add',
  'app/api/bookings/[id]/approve/route.ts',
  'components/bookings/BookingDetailModal.tsx',
  'components/bookings/BookingsClient.tsx',
]);
run(['commit', '-m', 'fix: prevent cancelled bookings from reverting to pending']);
run(['push', 'origin', 'master']);
run(['log', '--oneline', '-3']);

fs.writeFileSync(cwd + '\\git-push8-log.txt', log.join('\n'));
