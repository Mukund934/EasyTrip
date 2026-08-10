/**
 * Undo everything `global-setup.js` provisioned (IMP-094).
 *
 * Written to be safe to run twice and safe to run after a crashed setup: every step is guarded,
 * because a teardown that throws leaves an orphaned Postgres holding a port and the next run fails
 * for a reason that has nothing to do with the code under test.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATE_FILE = path.join(os.tmpdir(), 'easytrip-e2e-state.json');
const log = (message) => console.log(`  [e2e teardown] ${message}`);

module.exports = async () => {
  if (!fs.existsSync(STATE_FILE)) return;

  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    fs.rmSync(STATE_FILE, { force: true });
    return;
  }

  if (state.apiPid) {
    try {
      process.kill(state.apiPid);
      log(`stopped the API (pid ${state.apiPid})`);
    } catch {
      /* already gone */
    }
  }

  if (state.dataDir) {
    const pgCtl = state.pgBin ? path.join(state.pgBin, 'pg_ctl') : 'pg_ctl';
    try {
      execFileSync(pgCtl, ['-D', state.dataDir, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
      log('stopped the throwaway Postgres');
    } catch {
      /* already stopped */
    }
    fs.rmSync(state.dataDir, { recursive: true, force: true });
    fs.rmSync(`${state.dataDir}.log`, { force: true });
  }

  fs.rmSync(STATE_FILE, { force: true });
};
