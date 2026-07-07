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

run(['add', 'lib/ai.ts']);
run(['commit', '-m', 'fix: label special requests as "Special Requests" in guest Viber/LINE messages']);
run(['push', 'origin', 'master']);
run(['log', '--oneline', '-3']);

fs.writeFileSync(cwd + '\\git-push6-log.txt', log.join('\n'));
