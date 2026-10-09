const crypto = require('crypto');
const { logEvent } = require('../services/logService');

const SKIP_PATHS = new Set(['/favicon.ico']);

function requestLogger(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  if (SKIP_PATHS.has(req.path)) return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    // Fire-and-forget: a request that already finished must not wait on its own log line.
    logEvent({
      level,
      message: `${req.method} ${req.originalUrl}`,
      source: 'http',
      req,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
    }).catch(() => {}); // logEvent already swallows its own errors; this is just a safety net
  });

  next();
}

module.exports = { requestLogger };