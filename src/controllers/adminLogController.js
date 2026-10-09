const { SystemLog } = require('../models/logModel');
const { httpError } = require('../utils/httpError');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const LEVELS = ['info', 'warn', 'error', 'fatal'];

function showLogDashboard(req, res) {
  return res.render('admin-logs', {
    title: 'Application logs',
    currentUser: req.user,
  });
}

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildFilter({ level, source, q, from, to, statusCode, requestId } = {}) {
  const filter = {};

  if (LEVELS.includes(level)) filter.level = level;

  if (source) {
    const sourceValue = String(source).trim();
    if (sourceValue) filter.source = new RegExp(sourceValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const statusValue = Number.parseInt(statusCode, 10);
  if (Number.isFinite(statusValue)) filter.statusCode = statusValue;

  const requestIdValue = String(requestId || '').trim();
  if (requestIdValue) filter.requestId = requestIdValue;

  const text = String(q || '').trim();
  if (text) {
    const safeText = text.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { message: new RegExp(safeText, 'i') },
      { source: new RegExp(safeText, 'i') },
      { path: new RegExp(safeText, 'i') },
      { userEmail: new RegExp(safeText, 'i') },
      { requestId: new RegExp(safeText, 'i') },
    ];
  }

  const timestamp = {};
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (fromDate) timestamp.$gte = fromDate;
  if (toDate) timestamp.$lte = toDate;
  if (Object.keys(timestamp).length) filter.timestamp = timestamp;

  return filter;
}

async function listLogs(req, res) {
  const { level, source, q, from, to, statusCode, requestId } = req.query;
  const page = clampInt(req.query.page, { min: 1, max: Number.MAX_SAFE_INTEGER, fallback: 1 });
  const limit = clampInt(req.query.limit, { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE });

  const filter = buildFilter({ level, source, q, from, to, statusCode, requestId });

  const [data, total, sources] = await Promise.all([
    SystemLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SystemLog.countDocuments(filter),
    SystemLog.distinct('source'),
  ]);

  res.json({ data, page, limit, total, hasMore: page * limit < total, sources: sources.sort() });
}

async function getLog(req, res) {
  const log = await SystemLog.findById(req.params.id).lean();
  if (!log) throw httpError(404, 'Log entry not found.');
  res.json(log);
}

module.exports = { showLogDashboard, listLogs, getLog, buildFilter };
