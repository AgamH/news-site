const crypto = require('crypto');

const DEVICE_COOKIE_NAME = 'deviceId';
const DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identifies a guest's browser without requiring an account, so the comment rate
 * limit (3/min/device) and the "seen" feed filter both have something stable to key
 * on. Not a security boundary — a motivated visitor could clear or fake this cookie —
 * which is fine for what it's used for.
 *
 * Exposed two ways:
 *   - ensureDeviceId: route middleware (used by POST /:id/comments, which already has it)
 *   - getOrCreateDeviceId: the same logic as a plain function, for controllers reached by a
 *     route this project's routes/*.js files don't attach the middleware to (home page, the
 *     article page, the feed API) -- calling it there is the only way to get a stable id
 *     without editing those already-defined route files.
 * Whichever runs first for a given browser sets the cookie; every path after that reuses it.
 */
function getOrCreateDeviceId(req, res) {
  const existing = req.cookies && req.cookies[DEVICE_COOKIE_NAME];
  const deviceId = existing && UUID_RE.test(existing) ? existing : crypto.randomUUID();

  if (deviceId !== existing) {
    res.cookie(DEVICE_COOKIE_NAME, deviceId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: DEVICE_COOKIE_MAX_AGE_MS,
    });
  }

  req.deviceId = deviceId;
  return deviceId;
}

function ensureDeviceId(req, res, next) {
  getOrCreateDeviceId(req, res);
  next();
}

module.exports = { DEVICE_COOKIE_NAME, ensureDeviceId, getOrCreateDeviceId };
