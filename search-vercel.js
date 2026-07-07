const { execFileSync } = require('child_process');
const fs = require('fs');
const logPath = 'D:\\Car Rental - App\\search-vercel-log.txt';
fs.writeFileSync(logPath, 'searching...\n');
const L = s => fs.appendFileSync(logPath, s + '\n');

// Use git's bash to run where vercel
const git = 'C:\\Program Files\\Git\\bin\\git.exe';

// Use git bash to find vercel
try {
  const r = execFileSync('C:\\Program Files\\Git\\usr\\bin\\bash.exe', ['-c', 'which vercel || where.exe vercel 2>&1 || find /c/Users/PGIAlmira -name "vercel*" -maxdepth 6 2>/dev/null | head -10'], { encoding: 'utf8', timeout: 15000 });
  L('bash find: ' + r);
} catch(e) { L('bash err: ' + e.message + '\n' + (e.stderr || '')); }

// Check env vars
L('PATH: ' + process.env.PATH);
L('APPDATA: ' + process.env.APPDATA);
L('USERPROFILE: ' + process.env.USERPROFILE);

// Check specific dirs
const toCheck = [
  process.env.USERPROFILE + '\\AppData\\Roaming\\npm',
  process.env.USERPROFILE + '\\AppData\\Local\\npm',
  process.env.USERPROFILE + '\\.npm',
  process.env.USERPROFILE + '\\AppData\\Local\\Programs\\vercel',
  'C:\\vercel',
];
for (const d of toCheck) {
  try {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d);
      L(d + ': ' + files.slice(0, 20).join(', '));
    } else L(d + ': not found');
  } catch(e) { L(d + ': err ' + e.message); }
}
L('done');
