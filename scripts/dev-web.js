const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = process.env[key] || value;
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const expoPort = process.env.EXPO_WEB_PORT || '8092';
const aiEndpoint = process.env.EXPO_PUBLIC_SIDEHUSTLE_AI_MATCH_ENDPOINT || 'http://localhost:8787/ai-match';
const expoUrl = `http://localhost:${expoPort}`;
const isWindows = process.platform === 'win32';
const children = [];
const managedPorts = Array.from(new Set([expoPort, getLocalAiPort()].filter(Boolean)));
let shuttingDown = false;

function getLocalAiPort() {
  try {
    const url = new URL(aiEndpoint);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (!isLocal) {
      return null;
    }

    return url.port || (url.protocol === 'https:' ? '443' : '80');
  } catch {
    return null;
  }
}

function commandFor(baseCommand, args) {
  if (!isWindows) {
    return { command: baseCommand, args };
  }

  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', [baseCommand, ...args].map(quoteForCmd).join(' ')],
  };
}

function quoteForCmd(value) {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function execFileQuiet(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true }, () => resolve());
  });
}

async function killPort(port) {
  if (!port) {
    return;
  }

  if (isWindows) {
    const script = [
      `$port = ${Number(port)}`,
      '$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue',
      '$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique',
      'foreach ($processId in $pids) {',
      '  if ($processId -and $processId -ne $PID) {',
      '    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue',
      '  }',
      '}',
    ].join('; ');

    await execFileQuiet('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
    return;
  }

  await execFileQuiet('sh', ['-c', `lsof -ti tcp:${port} | xargs -r kill -9`]);
}

async function killManagedPorts(reason) {
  if (managedPorts.length === 0) {
    return;
  }

  console.log(`${reason}: clearing ports ${managedPorts.join(', ')}`);
  await Promise.all(managedPorts.map((port) => killPort(port)));
}

function start(label, baseCommand, args) {
  const launch = commandFor(baseCommand, args);
  const child = spawn(launch.command, launch.args, {
    env: process.env,
    stdio: 'inherit',
  });

  children.push(child);

  child.on('error', (error) => {
    console.error(`${label} failed to start: ${error.message}`);
    void shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown || signal) {
      return;
    }

    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}.`);
      void shutdown(code);
    }
  });
}

async function killChild(child) {
  if (child.killed || !child.pid) {
    return;
  }

  if (isWindows) {
    await execFileQuiet('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']);
    return;
  }

  child.kill('SIGTERM');
}

async function stopChildren() {
  await Promise.all(children.map((child) => killChild(child)));
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await stopChildren();
  await killManagedPorts('Shutdown');
  process.exit(exitCode);
}

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

async function main() {
  console.log(`Starting SideHustle dev web on ${expoUrl}`);
  await killManagedPorts('Startup');

  if (getLocalAiPort()) {
    start('AI match endpoint', 'node', ['./scripts/ai-match-endpoint.js']);
  } else {
    console.log(`Using configured AI match endpoint: ${aiEndpoint}`);
  }

  start('Expo web', 'npx', ['expo', 'start', '--web', '--port', expoPort]);
}

void main();
