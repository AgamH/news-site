const mongoose = require('mongoose');

const COMMENT_RATE_LIMIT = 3;
const COMMENT_RATE_WINDOW_MS = 60 * 1000;

const commentSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true, index: true },
    deviceId: { type: String, required: true, trim: true, index: true },
    authorName: { type: String, default: 'Guest', trim: true, maxlength: 60 },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.deviceId;
        delete returnedObject.article;
        return returnedObject;
      },
    },
  },
);

commentSchema.index({ article: 1, createdAt: 1 });
commentSchema.index({ deviceId: 1, createdAt: -1 });

const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

async function isRateLimited(deviceId) {
  const windowStart = new Date(Date.now() - COMMENT_RATE_WINDOW_MS);
  const recentCount = await Comment.countDocuments({ deviceId, createdAt: { $gte: windowStart } });
  return recentCount >= COMMENT_RATE_LIMIT;
}

const DEMO_COMMENT_BODIES = [
  'Thanks for the clear reporting on this.',
  'Any updates expected on this story?',
  'This matches what I saw locally as well.',
  'Would love a follow-up once more details are known.',
  'Good to see this covered.',
];

async function seedCommentsIfEmpty(articles) {
  if (await Comment.exists({})) return;
  const liveArticles = articles.filter((article) => article.published);
  if (!liveArticles.length) return;
  const rows = [];
  for (const article of liveArticles) {
    if (Math.random() > 0.3) continue;
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i += 1) {
      rows.push({
        article: article._id,
        deviceId: 'seed-demo-device',
        authorName: 'Guest',
        body: DEMO_COMMENT_BODIES[Math.floor(Math.random() * DEMO_COMMENT_BODIES.length)],
      });
    }
  }
  if (rows.length) await Comment.insertMany(rows);
}

module.exports = { Comment, isRateLimited, seedCommentsIfEmpty, COMMENT_RATE_LIMIT, COMMENT_RATE_WINDOW_MS };