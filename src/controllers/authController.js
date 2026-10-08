const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/userModel');
const { seedArticlesIfEmpty } = require('../models/articleModel');
const { COOKIE_NAME, getJwtSecret } = require('../middleware/authMiddleware');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}

function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

async function register(req, res) {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = req.body.role === 'editor' ? 'editor' : 'reporter';

  if (!name || !emailPattern.test(email) || password.length < 8) {
    return res.status(400).json({ message: 'Name, a valid email, and a password of at least 8 characters are required.' });
  }
  if (role === 'editor') {
    if (!process.env.EDITOR_SIGNUP_CODE) {
      return res.status(503).json({ message: 'Editor registration is not configured.' });
    }
    if (String(req.body.editorCode || '') !== process.env.EDITOR_SIGNUP_CODE) {
      return res.status(403).json({ message: 'The editor registration code is invalid.' });
    }
  }
  if (await User.exists({ email })) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const rounds = Math.min(Math.max(Number(process.env.BCRYPT_ROUNDS) || 12, 10), 15);
  const passwordHash = await bcrypt.hash(password, rounds);

  let user;
  try {
    user = await User.create({ name, email, passwordHash, role });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    throw error;
  }

  if (role === 'reporter') await seedArticlesIfEmpty([{ id: user.id, name: user.name }]);
  const token = createToken(user);
  setTokenCookie(res, token);
  return res.status(201).json({ token, user: user.toJSON() });
}

async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  const token = createToken(user);
  setTokenCookie(res, token);
  return res.json({ token, user: user.toJSON() });
}

function currentUser(req, res) {
  return res.json({ user: req.user.toJSON() });
}

function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  return res.json({ message: 'Logged out successfully.' });
}

module.exports = { register, login, currentUser, logout };