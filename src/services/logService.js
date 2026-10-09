const fs = require('fs');
const path = require('path');
const { SystemLog } = require('../models/logModel');

const LOG_FILE_ENABLED = process.env.LOG_TO_FILE === 'true';
const LOG_FILE_PATH = path.join(__dirname, '..', '..', 'logs', 'application.log');

const CONSOLE_METHOD = { info: 'log', warn: 'warn', error: 'error', fatal: 'error' };

/**
 * Records one operational or error event. This function must never throw or reject:
 * a failure to log is swallowed (and printed to the console) rather than allowed to
 * break the request that triggered it. Call sites fire this without awaiting it
 * unless they specifically need to know logging finished.
 *
 *   logEvent({ level: 'error', message: 'Login failed', source: 'auth', req, statusCode: 401 })
 */
async function logEvent({
  level = 'info',
  message,
  source = 'application',
  req = null,
  statusCode = null,
  durationMs = null,
  stack = '',
  metadata = {},
} = {}) {
  const entry = {
    level,
    message: String(message || '').slice(0, 2000),
    source,
    requestId: (req && req.id) || '',
    method: (req && req.method) || '',
    path: (req && (req.originalUrl || req.path)) || '',
    statusCode,
    durationMs,
    userId: (req && req.user && req.user.id) || null,
    userEmail: (req && req.user && req.user.email) || '',
    userRole: (req && req.user && req.user.role) || '',
    ip: (req && req.ip) || '',
    stack: String(stack || '').slice(0, 4000),
    metadata,
  };

  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${source}: ${entry.message}`
    + (entry.path ? ` (${entry.method} ${entry.path}${statusCode ? ` -> ${statusCode}` : ''})` : '');
  // eslint-disable-next-line no-console
  console[CONSOLE_METHOD[level] || 'log'](line);

  try {
    await SystemLog.create(entry);
  } catch (dbError) {
    // The database being unreachable must not take the logger down with it.
    // eslint-disable-next-line no-console
    console.error('[logService] failed to write log to MongoDB:', dbError.message);
  }

  if (LOG_FILE_ENABLED) {
    try {
      await fs.promises.mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
      await fs.promises.appendFile(LOG_FILE_PATH, `${line}\n`);
    } catch (fileError) {
      // eslint-disable-next-line no-console
      console.error('[logService] failed to write log file:', fileError.message);
    }
  }
}

module.exports = { logEvent };
