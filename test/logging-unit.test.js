const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEntry } = require('../src/services/logService');
const { buildFilter } = require('../src/controllers/adminLogController');

test('normalizes log entries and redacts sensitive metadata', () => {
  const entry = normalizeEntry('error', 'Failed operation', {
    source: 'unit-test',
    statusCode: 500,
    error: new Error('Synthetic failure'),
    metadata: {
      password: 'plain-text-password',
      authorization: 'Bearer private-token',
      safe: 'visible',
    },
  });

  assert.equal(entry.level, 'error');
  assert.equal(entry.metadata.password, '[REDACTED]');
  assert.equal(entry.metadata.authorization, '[REDACTED]');
  assert.equal(entry.metadata.safe, 'visible');
  assert.match(entry.stack, /Synthetic failure/);
});

test('builds safe MongoDB filters for the administrator screen', () => {
  const filter = buildFilter({
    level: 'error',
    source: 'database',
    statusCode: '500',
    requestId: '  request-123  ',
    q: 'connection (failed)',
    from: '2026-09-01T00:00:00.000Z',
  });

  assert.equal(filter.level, 'error');
  assert.equal(filter.statusCode, 500);
  assert.equal(filter.requestId, 'request-123');
  assert.ok(filter.source instanceof RegExp);
  assert.ok(filter.timestamp.$gte instanceof Date);
  assert.ok(Array.isArray(filter.$or));
  assert.ok(filter.$or[0].message.test('connection (failed)'));
});