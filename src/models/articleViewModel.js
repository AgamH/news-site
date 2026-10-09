const mongoose = require('mongoose');

const articleViewSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true, index: true },
    viewedAt: { type: Date, default: Date.now, index: true },
    deviceId: { type: String, default: null, index: true },
  },
  { versionKey: false },
);

articleViewSchema.index({ article: 1, viewedAt: 1 });
articleViewSchema.index({ deviceId: 1, article: 1 });

const ArticleView = mongoose.models.ArticleView || mongoose.model('ArticleView', articleViewSchema);

async function recordView(articleId, deviceId = null) {
  await ArticleView.create({ article: articleId, deviceId: deviceId || null });
}

/** Article ids this device has viewed before, for the home feed's seen/unseen */
async function getSeenArticleIds(deviceId) {
  if (!deviceId) return [];
  return ArticleView.distinct('article', { deviceId });
}

async function seedViewsIfEmpty(articles) {
  if (await ArticleView.exists({})) return;
  const rows = [];
  const now = Date.now();
  for (const article of articles) {
    if (!article.published) continue;
    const eventsCount = Math.max(5, Math.min(article.views, 300));
    // Spread from the first publication (not the latest update) so the analytics chart
    // has views on both sides of every update marker.
    const firstPublishedAt = (article.publishHistory?.[0]?.publishedAt || article.published.publishedAt).getTime();
    const spanMs = Math.max(now - firstPublishedAt, 24 * 60 * 60 * 1000);
    for (let i = 0; i < eventsCount; i += 1) {
      rows.push({ article: article._id, viewedAt: new Date(firstPublishedAt + Math.random() * spanMs) });
    }
  }
  if (rows.length) await ArticleView.insertMany(rows, { ordered: false });
}

module.exports = { ArticleView, recordView, getSeenArticleIds, seedViewsIfEmpty };