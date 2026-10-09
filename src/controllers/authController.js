const bcrypt = require('bcryptjs');
const { User } = require('../models/userModel');
const { signAuthToken, setAuthCookie, clearAuthCookie } = require('../middleware/authMiddleware');
const { httpError } = require('../utils/httpError');

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTERABLE_ROLES = ['reporter', 'editor'];

// Same message for "no such account" and "wrong password" so a login attempt can never be used
// to discover which emails are registered.
const BAD_CREDENTIALS_MESSAGE = 'Incorrect email or password.';

/**
 * A small in-memory sliding-window limiter for login attempts, keyed by IP + email.
 * In-memory is fine for a single-process student deployment; it resets on restart,
 * which only means a fresh grace period, not a security hole.
 */
const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const loginAttempts = new Map(); // key -> array of attempt timestamps (ms)

function isLoginRateLimited(key) {
  const now = Date.now();
  const attempts = (loginAttempts.get(key) || []).filter((t) => now - t < LOGIN_ATTEMPT_WINDOW_MS);
  loginAttempts.set(key, attempts);
  return attempts.length >= LOGIN_ATTEMPT_LIMIT;
}

function recordLoginAttempt(key) {
  const attempts = loginAttempts.get(key) || [];
  attempts.push(Date.now());
  loginAttempts.set(key, attempts);
}

function clearLoginAttempts(key) {
  loginAttempts.delete(key);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function issueSession(res, user) {
  const token = signAuthToken(user);
  setAuthCookie(res, token);
}

async function register(req, res) {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const role = String(req.body.role || '');

  if (!name) throw httpError(400, 'Enter your name.');
  if (!EMAIL_RE.test(email)) throw httpError(400, 'Enter a valid email address.');
  if (password.length < PASSWORD_MIN_LENGTH) throw httpError(400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  if (!REGISTERABLE_ROLES.includes(role)) throw httpError(400, 'Choose whether you are a reporter or an editor.');

  if (role === 'editor') {
    const requiredCode = process.env.EDITOR_SIGNUP_CODE;
    // If no code is configured at all, editor self-registration is closed rather than left wide open.
    if (!requiredCode || req.body.editorCode !== requiredCode) {
      throw httpError(403, 'That editor registration code is not valid.');
    }
  }

  if (await User.exists({ email })) throw httpError(409, 'An account with this email already exists.');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });

  issueSession(res, user);
  res.status(201).json({ user: { name: user.name, role: user.role } });
}

async function login(req, res) {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const rateLimitKey = `${req.ip}:${email}`;

  if (!email || !password) throw httpError(400, 'Enter your email and password.');

  if (isLoginRateLimited(rateLimitKey)) {
    throw httpError(429, 'Too many attempts. Wait a few minutes and try again.');
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    recordLoginAttempt(rateLimitKey);
    throw httpError(401, BAD_CREDENTIALS_MESSAGE);
  }

  clearLoginAttempts(rateLimitKey);
  issueSession(res, user);
  res.json({ user: { name: user.name, role: user.role } });
}

/** Not wrapped in asyncHandler by the routes (see authRoutes.js) — must stay synchronous. */
function currentUser(req, res) {
  res.json({ user: req.user });
}

/** Not wrapped in asyncHandler by the routes, and runs with no auth required — must stay synchronous. */
function logout(req, res) {
  clearAuthCookie(res);
  res.json({ ok: true });
}

module.exports = { register, login, currentUser, logout };
