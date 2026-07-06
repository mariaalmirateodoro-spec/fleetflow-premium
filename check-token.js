const fs = require('fs');
const logPath = 'D:\\Car Rental - App\\check-token-log.txt';
fs.writeFileSync(logPath, 'start\n');
const L = s => fs.appendFileSync(logPath, s + '\n');

// Check vercel config for token
const possibleConfigs = [
  process.env.USERPROFILE + '\\.vercel',
  process.env.USERPROFILE + '\\.config\\vercel',
  process.env.APPDATA + '\\vercel',
  process.env.LOCALAPPDATA + '\\vercel',
  'D:\\Car Rental - App\\.vercel',
];

for (const d of possibleConfigs) {
  try {
    if (fs.existsSync(d)) {
      const files = fs.readdirSync(d);
      L(d + ': ' + files.join(', '));
      for (const f of files) {
        try {
          const content = fs.readFileSync(d + '\\' + f, 'utf8');
          L('  ' + f + ': ' + content.substring(0, 200));
        } catch(e2) {}
      }
    } else L(d + ': not found');
  } catch(e) { L(d + ': err ' + e.message); }
}

// Check env
L('VERCEL_TOKEN env: ' + (process.env.VERCEL_TOKEN ? 'SET' : 'not set'));

// Check .env files
const envFiles = ['.env', '.env.local', '.env.production'];
for (const f of envFiles) {
  try {
    const c = fs.readFileSync('D:\\Car Rental - App\\' + f, 'utf8');
    const lines = c.split('\n').filter(l => l.includes('VERCEL') || l.includes('TOKEN'));
    if (lines.length) L(f + ' VERCEL lines: ' + lines.join('; '));
  } catch(e) {}
}

L('done');
