const fs = require('fs');
const path = require('path');
const { SystemLog } = require('../models/logModel');

const LOG_FILE_ENABLED = process.env.LOG_TO_FILE === 'true';
const LOG_FILE_PATH = path.join(__dirname, '..', '..', 'logs', 'application.log');

const CONSOLE_METHOD = { info: 'log', warn: 'warn', error: 'error', fatal: 'error' };
const REDACTED = '[REDACTED]';
const REDACTED_KEYS = ['password', 'authorization', 'token', 'secret', 'apikey', 'api_key', 'cookie', 'jwt'];

function redactValue(key, value) {
  const lowerKey = String(key || '').toLowerCase();
  if (REDACTED_KEYS.some((redactKey) => lowerKey.includes(redactKey))) {
    return REDACTED;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(`${key}.${index}`, item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, redactValue(nestedKey, nestedValue)]));
  }

  return value;
}

function normalizeEntry(level, message, { source = 'application', statusCode = null, error = null, metadata = {} } = {}) {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata || {}).map(([key, value]) => [key, redactValue(key, value)]),
  );

  return {
    level: String(level || 'info').toLowerCase(),
    message: String(message || '').slice(0, 2000),
    source: String(source || 'application'),
    statusCode: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
    metadata: safeMetadata,
    stack: error && error.stack ? String(error.stack).slice(0, 4000) : '',
  };
}

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
  const normalized = normalizeEntry(level, message, { source, statusCode, error: { stack }, metadata });

  const entry = {
    ...normalized,
    requestId: (req && req.id) || '',
    method: (req && req.method) || '',
    path: (req && (req.originalUrl || req.path)) || '',
    durationMs,
    userId: (req && req.user && req.user.id) || null,
    userEmail: (req && req.user && req.user.email) || '',
    userRole: (req && req.user && req.user.role) || '',
    ip: (req && req.ip) || '',
    metadata: normalized.metadata,
  };

  const line = `[${new Date().toISOString()}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`
    + (entry.path ? ` (${entry.method} ${entry.path}${entry.statusCode ? ` -> ${entry.statusCode}` : ''})` : '');
  // eslint-disable-next-line no-console
  console[CONSOLE_METHOD[entry.level] || 'log'](line);

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

module.exports = { logEvent, normalizeEntry };