const { test } = require('node:test');
const assert = require('node:assert/strict');
const { escapeRegex, parseListQuery, sanitizeCommentInput } = require('../src/utils/articleValidation');
const { buildPublishedArticleFilter } = require('../src/controllers/articleController');

test('escapeRegex neutralizes regex special characters', () => {
  const pattern = new RegExp(escapeRegex('a.b*c?'), 'i');
  assert.equal(pattern.test('a.b*c?'), true);
  assert.equal(pattern.test('axbyyc'), false); // would match if the input were used as a live regex
});

test('parseListQuery fills in defaults for an empty query', () => {
  assert.deepEqual(parseListQuery({}), { q: '', category: '', seen: 'all', sort: 'newest', page: 1, limit: 20 });
});

test('parseListQuery rejects an unknown category rather than passing it through', () => {
  const result = parseListQuery({ category: 'NotARealCategory' });
  assert.equal(result.category, '');
});

test('parseListQuery accepts a known category', () => {
  const result = parseListQuery({ category: 'Sports' });
  assert.equal(result.category, 'Sports');
});

test('parseListQuery accepts every additional category shown on the homepage', () => {
  assert.equal(parseListQuery({ category: 'Entertainment' }).category, 'Entertainment');
  assert.equal(parseListQuery({ category: 'Science' }).category, 'Science');
});

test('published article search matches the title only, safely', () => {
  const filter = buildPublishedArticleFilter({ q: 'Dana (editor)', category: 'Science' });

  assert.equal(filter['published.category'], 'Science');
  assert.equal(filter.$or, undefined);
  assert.equal(filter['published.summary'], undefined);
  assert.equal(filter.reporterName, undefined);
  assert.deepEqual(filter['published.title'], { $regex: escapeRegex('Dana (editor)'), $options: 'i' });
});

test('parseListQuery falls back to a safe value for an invalid seen/sort', () => {
  const result = parseListQuery({ seen: 'definitely-not-valid', sort: 'also-not-valid' });
  assert.equal(result.seen, 'all');
  assert.equal(result.sort, 'newest');
});

test('parseListQuery clamps page and limit into a sane range', () => {
  assert.equal(parseListQuery({ limit: '9999' }).limit, 50);
  assert.equal(parseListQuery({ limit: '-5' }).limit, 1); // a valid but out-of-range int is clamped, not defaulted
  assert.equal(parseListQuery({ page: '0' }).page, 1);
  assert.equal(parseListQuery({ page: 'not-a-number' }).page, 1);
});

test('parseListQuery trims and caps the search string', () => {
  const long = 'a'.repeat(500);
  assert.equal(parseListQuery({ q: `  hello  ` }).q, 'hello');
  assert.equal(parseListQuery({ q: long }).q.length, 100);
});

test('sanitizeCommentInput rejects an empty body', () => {
  const result = sanitizeCommentInput({ body: '   ', authorName: 'Dana' });
  assert.ok(result.error);
});

test('sanitizeCommentInput rejects an overly long body', () => {
  const result = sanitizeCommentInput({ body: 'x'.repeat(1001) });
  assert.ok(result.error);
});

test('sanitizeCommentInput defaults a blank author name to Guest', () => {
  const result = sanitizeCommentInput({ body: 'Nice article!' });
  assert.equal(result.authorName, 'Guest');
  assert.equal(result.body, 'Nice article!');
});

test('sanitizeCommentInput trims and caps the author name', () => {
  const result = sanitizeCommentInput({ body: 'Hi', authorName: `  ${'a'.repeat(100)}  ` });
  assert.equal(result.authorName.length, 60);
});
