/**
 * Python Bridge for Rynex Cyber Lead Intelligence Engine.
 * Spawns server/python/rynex_engine.py with JSON stdin/stdout for fast, robust execution.
 */
const { spawn } = require('child_process');
const path = require('path');

const ENGINE_SCRIPT = path.join(__dirname, '..', 'python', 'rynex_engine.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python';

/**
 * Execute python engine with arguments and optional stdin payload
 */
function invokePythonEngine(args, stdinPayload = null, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    let stdoutData = '';
    let stderrData = '';
    let isSettled = false;

    const child = spawn(PYTHON_BIN, [ENGINE_SCRIPT, ...args], {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        child.kill('SIGTERM');
        reject(new Error(`Python engine timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to spawn Python process: ${err.message}`));
      }
    });

    child.on('close', (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);

        if (code !== 0) {
          return reject(new Error(`Python engine exited with code ${code}: ${stderrData || stdoutData}`));
        }

        try {
          // Extract JSON string from stdout (ignoring any trailing/leading non-json output)
          const trimmed = stdoutData.trim();
          const jsonStart = trimmed.indexOf('{');
          const jsonEnd = trimmed.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
            const jsonSub = trimmed.slice(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(jsonSub);
            resolve(parsed);
          } else {
            reject(new Error(`Invalid JSON output from Python engine: ${stdoutData.slice(0, 300)}`));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Python engine output: ${err.message}. Raw: ${stdoutData.slice(0, 200)}`));
        }
      }
    });

    if (stdinPayload !== null) {
      const payloadStr = typeof stdinPayload === 'string' ? stdinPayload : JSON.stringify(stdinPayload);
      child.stdin.write(payloadStr);
      child.stdin.end();
    }
  });
}

/**
 * Discover client leads for target cybersecurity service
 */
async function findLeads(query) {
  const payload = {
    niche: query.niche || 'Fintech',
    location: query.location || '',
    serviceKey: query.serviceKey || 'vapt',
    limit: query.limit || 10,
    yourOffer: query.yourOffer || ''
  };

  try {
    const result = await invokePythonEngine(['web-find', '--payload', '-'], payload, 30000);
    return result;
  } catch (err) {
    console.error('[python_bridge] findLeads error:', err.message);
    throw err;
  }
}

/**
 * Run instant passive perimeter security audit
 */
async function quickAudit(domain) {
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
    const result = await invokePythonEngine(['web-audit', '--domain', cleanDomain], null, 15000);
    return result;
  } catch (err) {
    console.error('[python_bridge] quickAudit error:', err.message);
    throw err;
  }
}

/**
 * Generate contextual outreach email and branded HTML
 */
async function generateEmail(payload) {
  try {
    const result = await invokePythonEngine(['web-email', '--payload', '-'], payload, 15000);
    return result;
  } catch (err) {
    console.error('[python_bridge] generateEmail error:', err.message);
    throw err;
  }
}

module.exports = {
  findLeads,
  quickAudit,
  generateEmail,
  invokePythonEngine
};
