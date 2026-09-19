const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    level: {
      type: String,
      enum: ['info', 'warn', 'error', 'fatal'],
      required: true,
      index: true,
    },
    message: { type: String, required: true, trim: true },
    source: { type: String, default: 'application', trim: true, index: true },
    requestId: { type: String, default: '', trim: true, index: true },
    method: { type: String, default: '', trim: true },
    path: { type: String, default: '', trim: true },
    statusCode: { type: Number, default: null, index: true },
    durationMs: { type: Number, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userEmail: { type: String, default: '', trim: true },
    userRole: { type: String, default: '', trim: true },
    ip: { type: String, default: '', trim: true },
    stack: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    versionKey: false,
    collection: 'system_logs',
  },
);

logSchema.index({ level: 1, timestamp: -1 });
logSchema.index({ source: 1, timestamp: -1 });
logSchema.index({ message: 'text', source: 'text', path: 'text', userEmail: 'text' });

const SystemLog = mongoose.models.SystemLog || mongoose.model('SystemLog', logSchema);

module.exports = { SystemLog };