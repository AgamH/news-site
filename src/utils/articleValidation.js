const { CATEGORIES } = require('../models/articleModel');

const SORT_VALUES = ['newest', 'popular'];
const SEEN_VALUES = ['all', 'seen', 'unseen'];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_COMMENT_BODY_LENGTH = 1000;
const MAX_COMMENT_NAME_LENGTH = 60;

/** Escapes a string for safe use inside a RegExp, so user search input can never be read as regex syntax. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function isValidCategory(value) {
  return CATEGORIES.includes(value);
}

/**
 * Normalizes the home feed's query params (?q=&category=&seen=&sort=&page=&limit=) into a
 * clean, bounded shape. Unknown or out-of-range values silently fall back to a sane default
 * rather than erroring, since a stale or hand-edited URL should never crash the feed.
 */
function parseListQuery(query = {}) {
  const q = String(query.q || '').trim().slice(0, MAX_SEARCH_LENGTH);
  const category = isValidCategory(query.category) ? query.category : '';
  const seen = SEEN_VALUES.includes(query.seen) ? query.seen : 'all';
  const sort = SORT_VALUES.includes(query.sort) ? query.sort : 'newest';
  const limit = clampInt(query.limit, { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE });
  const page = clampInt(query.page, { min: 1, max: Number.MAX_SAFE_INTEGER, fallback: 1 });
  return { q, category, seen, sort, page, limit };
}

/** Validates a posted comment body/author. Returns { body, authorName } or throws via the caller's own httpError. */
function sanitizeCommentInput({ body, authorName }) {
  const cleanBody = String(body || '').trim();
  const cleanName = String(authorName || '').trim().slice(0, MAX_COMMENT_NAME_LENGTH);
  if (!cleanBody) return { error: 'Write something before posting.' };
  if (cleanBody.length > MAX_COMMENT_BODY_LENGTH) {
    return { error: `Comments are limited to ${MAX_COMMENT_BODY_LENGTH} characters.` };
  }
  return { body: cleanBody, authorName: cleanName || 'Guest' };
}

module.exports = {
  escapeRegex,
  isValidCategory,
  parseListQuery,
  sanitizeCommentInput,
  CATEGORIES,
  SORT_VALUES,
  SEEN_VALUES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
