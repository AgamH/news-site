const { Article } = require('../models/articleModel');
const { Comment } = require('../models/commentModel');
const { recordView } = require('../models/articleViewModel');
const { readUserFromCookie } = require('../middleware/authMiddleware');
const { getOrCreateDeviceId } = require('../middleware/deviceMiddleware');
const { getArticleFeed } = require('./articleController');
const { httpError } = require('../utils/httpError');
const { logEvent } = require('../services/logService');

const REGISTERABLE_ROLES = ['reporter', 'editor'];
const ROLE_HOME = { reporter: '/reporter', editor: '/editor' };

async function showHomePage(req, res) {
  const { data, page, limit, total, hasMore, filters, categories } = await getArticleFeed(req, res);
  res.render('index', {
    title: 'The Web Daily',
    currentUser: req.user, // set by attachUserIfPresent on this route
    categories,
    articles: data,
    pagination: { page, limit, total, hasMore },
    filters,
  });
}

async function showArticlePage(req, res) {
  const article = await Article.findOne({ _id: req.params.id, published: { $ne: null } }).lean();
  if (!article) throw httpError(404, 'That article does not exist or is no longer published.');

  const deviceId = getOrCreateDeviceId(req, res);

  // A view failing to record should never take the article page down with it.
  try {
    await Promise.all([
      Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }),
      recordView(article._id, deviceId),
    ]);
  } catch (error) {
    logEvent({
      level: 'warn',
      message: 'Failed to record an article view',
      source: 'articles',
      req,
      metadata: { articleId: String(article._id) },
      stack: error.stack,
    }).catch(() => {});
  }

  const commentDocs = await Comment.find({ article: article._id }).sort({ createdAt: -1 }).limit(200).lean();
  const comments = commentDocs.map((comment) => ({
    id: String(comment._id),
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt,
  }));

  res.render('article', {
    title: article.published.title,
    currentUser: req.user, // set by attachUserIfPresent on this route
    article: {
      id: String(article._id),
      title: article.published.title,
      summary: article.published.summary,
      content: article.published.content,
      imageUrl: article.published.imageUrl,
      category: article.published.category,
      reporterName: article.reporterName,
      publishedAt: article.published.publishedAt,
      views: article.views + 1, // reflects the increment above without a second read
    },
    comments,
  });
}

/** Not wrapped in asyncHandler by the routes (see pageRoutes.js) — must stay synchronous. */
function showLoginPage(req, res) {
  const user = readUserFromCookie(req);
  if (user) return res.redirect(ROLE_HOME[user.role] || '/');
  res.render('login', { title: 'Log in' });
}

/** Not wrapped in asyncHandler by the routes — must stay synchronous. */
function showRegistrationPage(req, res) {
  const role = req.params.role;
  if (!REGISTERABLE_ROLES.includes(role)) throw httpError(404, 'Page not found.');

  const user = readUserFromCookie(req);
  if (user) return res.redirect(ROLE_HOME[user.role] || '/');

  res.render('register', { title: `Create a ${role} account`, role });
}

/** Not wrapped in asyncHandler by the routes; reached after authenticatePage + requirePageRole('editor'). */
function showLogDashboard(req, res) {
  res.render('admin-log', { title: 'Operational Logs', currentUser: req.user });
}

module.exports = { showHomePage, showArticlePage, showLoginPage, showRegistrationPage, showLogDashboard };
