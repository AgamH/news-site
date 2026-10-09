const { Article } = require('../models/articleModel');
const { Comment, isRateLimited } = require('../models/commentModel');
const { getSeenArticleIds } = require('../models/articleViewModel');
const { getOrCreateDeviceId } = require('../middleware/deviceMiddleware');
const { escapeRegex, parseListQuery, sanitizeCommentInput, CATEGORIES } = require('../utils/articleValidation');
const { httpError } = require('../utils/httpError');

/** Shapes one Article document (from .lean()) into the JSON the home feed's client expects. */
function toFeedItem(doc, seenSet) {
  return {
    _id: doc._id,
    title: doc.published.title,
    summary: doc.published.summary,
    imageUrl: doc.published.imageUrl,
    category: doc.published.category,
    reporter: { name: doc.reporterName },
    publishedAt: doc.published.publishedAt,
    seen: seenSet.has(String(doc._id)),
  };
}

/**
 * The query behind the home feed: published articles only, filtered/sorted/paginated.
 * Shared by the JSON API (listPublishedArticles) and the server-rendered first page
 * (pageController.showHomePage), so the two can never drift out of sync with each other.
 *
 * Filters by the PUBLISHED snapshot (title/category as they were when approved), not the
 * reporter's current working draft, since that's what a public reader is actually seeing.
 */
async function getArticleFeed(req, res) {
  const { q, category, seen, sort, page, limit } = parseListQuery(req.query);
  const deviceId = getOrCreateDeviceId(req, res);

  const filter = { published: { $ne: null } };
  if (category) filter['published.category'] = category;
  if (q) filter['published.title'] = { $regex: escapeRegex(q), $options: 'i' };

  // Needed both to apply the seen/unseen filter and to flag each returned article either way.
  const seenIds = deviceId ? await getSeenArticleIds(deviceId) : [];
  if (seen === 'seen') filter._id = { $in: seenIds };
  else if (seen === 'unseen') filter._id = { $nin: seenIds };

  const sortSpec = sort === 'popular' ? { views: -1, _id: -1 } : { 'published.publishedAt': -1, _id: -1 };

  const [docs, total] = await Promise.all([
    Article.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).lean(),
    Article.countDocuments(filter),
  ]);

  const seenSet = new Set(seenIds.map(String));
  const data = docs.map((doc) => toFeedItem(doc, seenSet));
  const hasMore = page * limit < total;

  return { data, page, limit, total, hasMore, filters: { q, category, seen, sort }, categories: CATEGORIES };
}

async function listPublishedArticles(req, res) {
  const { data, page, limit, total, hasMore } = await getArticleFeed(req, res);
  res.json({ data, page, limit, total, hasMore });
}

async function getPublishedArticle(req, res) {
  // A general-purpose JSON read of one published article. The article PAGE itself
  // (pageController.showArticlePage) renders server-side for SEO and is what records a
  // view, so fetching this endpoint does not count as a view — it exists for any future
  // AJAX consumer (a share preview, etc.) that just needs the data.
  const article = await Article.findOne({ _id: req.params.id, published: { $ne: null } }).lean();
  if (!article) throw httpError(404, 'Article not found.');

  res.json({
    _id: article._id,
    title: article.published.title,
    summary: article.published.summary,
    content: article.published.content,
    imageUrl: article.published.imageUrl,
    category: article.published.category,
    reporter: { name: article.reporterName },
    publishedAt: article.published.publishedAt,
    views: article.views,
  });
}

async function postComment(req, res) {
  const article = await Article.findOne({ _id: req.params.id, published: { $ne: null } }).select('_id').lean();
  if (!article) throw httpError(404, 'Article not found.');

  if (await isRateLimited(req.deviceId)) {
    throw httpError(429, 'You are posting comments too quickly. Please wait a bit and try again.');
  }

  const parsed = sanitizeCommentInput(req.body || {});
  if (parsed.error) throw httpError(400, parsed.error);

  const comment = await Comment.create({
    article: article._id,
    deviceId: req.deviceId,
    authorName: parsed.authorName,
    body: parsed.body,
  });

  res.status(201).json({ comment });
}

module.exports = { getArticleFeed, listPublishedArticles, getPublishedArticle, postComment };
