const crypto = require('crypto');

const DEVICE_COOKIE_NAME = 'deviceId';
const DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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