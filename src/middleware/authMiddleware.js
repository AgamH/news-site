const jwt = require('jsonwebtoken');
const { httpError } = require('../utils/httpError');

const AUTH_COOKIE_NAME = 'token';
const TOKEN_TTL = '7d';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is not configured. Copy .env.example to .env.');
  return value;
}

/**
 * The token carries name + role (not just a user id) so that authenticated pages and
 * API responses never need an extra database round trip just to know who is asking.
 * It is intentionally NOT re-checked against the database on every request: if an
 * account is deleted, its existing tokens stay valid until they expire (7 days).
 */
function signAuthToken(user) {
  return jwt.sign(
    { sub: String(user._id || user.id), name: user.name, role: user.role },
    secret(),
    { expiresIn: TOKEN_TTL },
  );
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

/** Reads and verifies the auth cookie. Returns { id, name, role } or null — never throws. */
function readUserFromCookie(req) {
  const token = req.cookies && req.cookies[AUTH_COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret());
    return { id: payload.sub, name: payload.name, role: payload.role };
  } catch {
    return null; // expired, tampered, or signed with an old secret
  }
}

/** For JSON API routes: 401 if not logged in. */
function authenticateJwt(req, res, next) {
  const user = readUserFromCookie(req);
  if (!user) return next(httpError(401, 'Please log in to continue.'));
  req.user = user;
  next();
}

/** For page routes: redirect to the login screen (with a return path) if not logged in. */
function authenticatePage(req, res, next) {
  const user = readUserFromCookie(req);
  if (!user) {
    const next_ = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${next_}`);
  }
  req.user = user;
  next();
}

/** For page routes where being logged out is fine (home, article): never blocks. */
function attachUserIfPresent(req, res, next) {
  req.user = readUserFromCookie(req);
  next();
}

/** For JSON API routes, after authenticateJwt: 403 if the role doesn't match. */
function requireRole(role) {
  return function checkRole(req, res, next) {
    if (!req.user || req.user.role !== role) return next(httpError(403, 'You do not have access to this.'));
    next();
  };
}

/** For page routes, after authenticatePage: send a logged-in user with the wrong role back home. */
function requirePageRole(role) {
  return function checkPageRole(req, res, next) {
    if (!req.user || req.user.role !== role) return res.redirect('/');
    next();
  };
}

module.exports = {
  AUTH_COOKIE_NAME,
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
  readUserFromCookie,
  authenticateJwt,
  authenticatePage,
  attachUserIfPresent,
  requireRole,
  requirePageRole,
};
