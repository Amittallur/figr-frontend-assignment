// Figr dev runner: starts both backend and frontend concurrently
const { spawn } = require('node:child_process');

const processes = [
  { name: 'backend', cmd: 'node', args: ['backend/server.js'], color: '\x1b[36m' },
  { name: 'frontend', cmd: 'npm', args: ['--prefix', 'frontend', 'run', 'dev'], color: '\x1b[35m' },
];

const children = [];

for (const p of processes) {
  const child = spawn(p.cmd, p.args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      console.log(`${p.color}[${p.name}]\x1b[0m ${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trimEnd().split('\n');
    for (const line of lines) {
      console.error(`${p.color}[${p.name}]\x1b[31m ${line}\x1b[0m`);
    }
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${p.color}[${p.name}]\x1b[0m exited with code ${code}`);
    }
  });

  children.push(child);
}

function cleanup() {
  for (const child of children) {
    try {
      child.kill('SIGINT');
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
