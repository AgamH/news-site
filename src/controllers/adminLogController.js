const mongoose = require('mongoose');
const { SystemLog } = require('../models/logModel');

const allowedLevels = new Set(['info', 'warn', 'error', 'fatal']);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFilter(query) {
  const filter = {};
  if (allowedLevels.has(query.level)) filter.level = query.level;
  if (query.source) filter.source = new RegExp(`^${escapeRegex(query.source)}$`, 'i');
  if (query.statusCode && Number.isInteger(Number(query.statusCode))) filter.statusCode = Number(query.statusCode);
  if (query.requestId) filter.requestId = String(query.requestId).trim();

  if (query.from || query.to) {
    filter.timestamp = {};
    if (query.from && !Number.isNaN(Date.parse(query.from))) filter.timestamp.$gte = new Date(query.from);
    if (query.to && !Number.isNaN(Date.parse(query.to))) filter.timestamp.$lte = new Date(query.to);
    if (!Object.keys(filter.timestamp).length) delete filter.timestamp;
  }

  if (query.q) {
    const pattern = new RegExp(escapeRegex(String(query.q).trim()), 'i');
    filter.$or = [
      { message: pattern },
      { source: pattern },
      { path: pattern },
      { userEmail: pattern },
      { requestId: pattern },
    ];
  }
  return filter;
}

async function listLogs(req, res) {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
  const filter = buildFilter(req.query);
  const [logs, total, sources] = await Promise.all([
    SystemLog.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SystemLog.countDocuments(filter),
    SystemLog.distinct('source'),
  ]);

  return res.json({
    logs,
    pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    sources: sources.sort(),
  });
}

async function getLog(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Log ID must be a valid MongoDB ObjectId.' });
  }
  const log = await SystemLog.findById(req.params.id).lean();
  if (!log) return res.status(404).json({ message: 'Log entry not found.' });
  return res.json(log);
}

function showLogDashboard(req, res) {
  return res.render('admin-logs', {
    title: 'Application logs',
    currentUser: req.user.toJSON(),
  });
}

module.exports = { listLogs, getLog, showLogDashboard, buildFilter };