const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = fs.createWriteStream('D:\\Car Rental - App\\deploy2-log.txt', { flags: 'w' });
const write = (s) => { log.write(s + '\n'); console.log(s); };

write('start');

const nodeDir = 'C:\\Program Files\\nodejs';
const env = {
  ...process.env,
  PATH: nodeDir + ';' + (process.env.PATH || ''),
  npm_config_cache: 'C:\\Users\\PGIAlmira\\AppData\\Local\\npm-cache',
};

const opts = {
  cwd: 'D:\\Car Rental - App',
  encoding: 'utf8',
  timeout: 180000,
  shell: true,
  env: env,
};

// Step 1: Install vercel globally with node in PATH
write('Installing vercel CLI...');
try {
  const r = spawnSync(
    '"C:\\Program Files\\nodejs\\npm.cmd"',
    ['install', '-g', 'vercel', '--force'],
    opts
  );
  write('npm install stdout: ' + (r.stdout || '').substring(0, 500));
  write('npm install stderr: ' + (r.stderr || '').substring(0, 500));
  write('npm install status: ' + r.status);
} catch (e) {
  write('npm install exception: ' + e.message);
}

// Step 2: Check if vercel.cmd exists globally
const vercelCmd = 'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\vercel.cmd';
write('vercel.cmd exists: ' + fs.existsSync(vercelCmd));

// Step 3: Deploy using vercel with env token if available
write('Deploying...');
const token = process.env.VERCEL_TOKEN || '';
const tokenArg = token ? ['--token', token] : [];

try {
  const r2 = spawnSync(
    '"C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\vercel.cmd"',
    ['deploy', '--prod', '--yes', '--cwd', 'D:\\Car Rental - App', ...tokenArg],
    { ...opts, timeout: 240000 }
  );
  write('deploy stdout: ' + (r2.stdout || '').substring(0, 1000));
  write('deploy stderr: ' + (r2.stderr || '').substring(0, 1000));
  write('deploy status: ' + r2.status);
} catch (e) {
  write('deploy exception: ' + e.message);
}

write('done');
log.end();
