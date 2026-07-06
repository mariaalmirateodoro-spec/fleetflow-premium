const fs = require('fs');
const path = require('path');

const lines = [];
const write = (s) => lines.push(s);

// Check for auth token in known locations
const authLocations = [
  'C:\\Users\\PGIAlmira\\.vercel\\auth.json',
  'C:\\Users\\PGIAlmira\\AppData\\Roaming\\com.vercel.cli\\auth.json',
  'C:\\Users\\PGIAlmira\\AppData\\Local\\com.vercel.cli\\auth.json',
  'C:\\Users\\PGIAlmira\\AppData\\Roaming\\vercel\\auth.json',
];

for (const loc of authLocations) {
  if (fs.existsSync(loc)) {
    write('AUTH FOUND: ' + loc);
    try { write('content: ' + fs.readFileSync(loc, 'utf8')); }
    catch (e) { write('read error: ' + e.message); }
  }
}

// Check vercel npm module
const vercelDir = 'C:\\Users\\PGIAlmira\\AppData\\Roaming\\npm\\node_modules\\vercel';
write('vercel dir exists: ' + fs.existsSync(vercelDir));

if (fs.existsSync(vercelDir)) {
  const pkgPath = path.join(vercelDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  write('vercel version: ' + pkg.version);
  write('main: ' + pkg.main);
  write('bin: ' + JSON.stringify(pkg.bin));

  // Find the actual JS entrypoint
  const binEntry = pkg.bin && (pkg.bin.vercel || pkg.bin.vc);
  write('bin entry: ' + binEntry);
  if (binEntry) {
    const fullPath = path.join(vercelDir, binEntry);
    write('bin file exists: ' + fs.existsSync(fullPath));
    write('bin full path: ' + fullPath);
  }

  // List top-level
  write('dirs: ' + fs.readdirSync(vercelDir).join(', '));
}

// Check .vercel project
const projFile = 'D:\\Car Rental - App\\.vercel\\project.json';
if (fs.existsSync(projFile)) {
  write('project.json: ' + fs.readFileSync(projFile, 'utf8'));
}

fs.writeFileSync('D:\\Car Rental - App\\check-vercel-log.txt', lines.join('\n'));
