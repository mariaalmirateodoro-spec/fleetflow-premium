const { execFileSync } = require('child_process');
const fs = require('fs');
const logPath = 'D:\\Car Rental - App\\do-vercel-log.txt';
fs.writeFileSync(logPath, 'start\n');
const L = s => fs.appendFileSync(logPath, s + '\n');

// Check npx
const npxPath = 'C:\\Program Files\\nodejs\\npx.cmd';
L('npx exists: ' + fs.existsSync(npxPath));

// List nodejs dir
const nodejsFiles = fs.readdirSync('C:\\Program Files\\nodejs');
L('nodejs files: ' + nodejsFiles.join(', '));

// Try running npx vercel deploy using Git bash (which has a proper shell)
const bash = 'C:\\Program Files\\Git\\bin\\bash.exe';
L('bash exists: ' + fs.existsSync(bash));

// Write a shell script to run vercel
const script = `#!/bin/bash
export PATH="/c/Program Files/nodejs:$PATH"
cd "/d/Car Rental - App"
echo "Running vercel deploy..."
npx vercel deploy --prod --yes 2>&1
echo "Exit: $?"
`;
fs.writeFileSync('D:\\Car Rental - App\\run-vercel-deploy.sh', script);
L('Shell script written');

try {
  const r = execFileSync(bash, ['D:\\Car Rental - App\\run-vercel-deploy.sh'], {
    encoding: 'utf8',
    timeout: 180000,
    env: { ...process.env, HOME: process.env.USERPROFILE }
  });
  L('Output: ' + r);
} catch(e) {
  L('Error: ' + e.message);
  L('Stdout: ' + (e.stdout || ''));
  L('Stderr: ' + (e.stderr || ''));
}
L('done');
