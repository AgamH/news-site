const { SystemLog } = require('../models/logModel');
const { httpError } = require('../utils/httpError');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const LEVELS = ['info', 'warn', 'error', 'fatal'];

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

async function listLogs(req, res) {
  const { level, source, q, from, to } = req.query;
  const page = clampInt(req.query.page, { min: 1, max: Number.MAX_SAFE_INTEGER, fallback: 1 });
  const limit = clampInt(req.query.limit, { min: 1, max: MAX_PAGE_SIZE, fallback: DEFAULT_PAGE_SIZE });

  const filter = {};
  if (LEVELS.includes(level)) filter.level = level;
  if (source) filter.source = String(source).trim();
  if (q) filter.message = { $regex: String(q).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (fromDate || toDate) {
    filter.timestamp = {};
    if (fromDate) filter.timestamp.$gte = fromDate;
    if (toDate) filter.timestamp.$lte = toDate;
  }

  const [data, total] = await Promise.all([
    SystemLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SystemLog.countDocuments(filter),
  ]);

  res.json({ data, page, limit, total, hasMore: page * limit < total });
}

async function getLog(req, res) {
  const log = await SystemLog.findById(req.params.id).lean();
  if (!log) throw httpError(404, 'Log entry not found.');
  res.json(log);
}

module.exports = { listLogs, getLog };
