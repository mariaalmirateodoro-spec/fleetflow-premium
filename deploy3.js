const { spawnSync } = require('child_process');
const fs = require('fs');

const log = fs.createWriteStream('D:\\Car Rental - App\\deploy3-log.txt', { flags: 'w' });
const write = (s) => { log.write(s + '\n'); };

write('start');

const nodeExe = 'C:\\Program Files\\nodejs\\node.exe';
const nodeDir = 'C:\\Program Files\\nodejs';

// Find vercel's main entry point
const vercelMain = 'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\node_modules\\vercel\\dist\\index.js';

write('vercel main exists: ' + fs.existsSync(vercelMain));

const env = {
  ...process.env,
  PATH: nodeDir + ';' + (process.env.PATH || ''),
};

// Run vercel directly via node (bypassing the .cmd wrapper)
write('Deploying...');
const r = spawnSync(
  nodeExe,
  [vercelMain, 'deploy', '--prod', '--yes'],
  {
    cwd: 'D:\\Car Rental - App',
    encoding: 'utf8',
    timeout: 240000,
    env: env,
  }
);

write('stdout: ' + (r.stdout || '').substring(0, 2000));
write('stderr: ' + (r.stderr || '').substring(0, 2000));
write('status: ' + r.status);
if (r.error) write('error: ' + r.error.message);

write('done');
log.end();
