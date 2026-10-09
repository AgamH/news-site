const mongoose = require('mongoose');
const { Article, ARTICLE_STATUSES, CATEGORIES } = require('../models/articleModel');
const { ArticleView } = require('../models/articleViewModel');
const { parseArticleInput } = require('../utils/articleInput');
const { httpError } = require('../utils/httpError');

const PAGE_SIZE = 20;

async function findArticle(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, 'Article not found.');
  const article = await Article.findById(id);
  if (!article) throw httpError(404, 'Article not found.');
  return article;
}

async function showDashboard(req, res) {
  const requestedStatus = String(req.query.status || 'pending');
  const statusFilter = ARTICLE_STATUSES.includes(requestedStatus) ? requestedStatus : 'pending';
  const filter = { status: statusFilter };
  const requestedPage = Number.parseInt(req.query.page, 10);
  const [total, statusCounts] = await Promise.all([
    Article.countDocuments(filter),
    Promise.all(ARTICLE_STATUSES.map((status) => Article.countDocuments({ status }))),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
  const sort = statusFilter === 'pending' ? { updatedAt: 1, _id: 1 } : { updatedAt: -1, _id: -1 };
  const articles = await Article.find(filter)
    .select('title category status reporterName published views updatedAt')
    .sort(sort)
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return res.render('editor-dashboard', {
    title: 'Editor desk',
    currentUser: req.user,
    articles: articles.map((article) => ({
      id: article._id.toString(),
      title: article.title,
      category: article.category,
      status: article.status,
      reporterName: article.reporterName,
      isLive: Boolean(article.published),
      views: article.views || 0,
    })),
    statusFilter,
    statuses: ARTICLE_STATUSES,
    total,
    page,
    pages,
    notice: req.query.notice === 'deleted' ? 'Unpublished article deleted.' : '',
    statusCounts: Object.fromEntries(ARTICLE_STATUSES.map((status, index) => [status, statusCounts[index]])),
  });
}

async function showReview(req, res) {
  const article = await findArticle(req.params.id);
  const snapshot = article.published;
  return res.render('editor-review', {
    title: 'Review article',
    currentUser: req.user,
    article: {
      id: article._id.toString(),
      status: article.status,
      reporterName: article.reporterName,
      isLive: Boolean(snapshot),
      editorNote: article.editorNote,
    },
    draft: {
      title: article.title,
      summary: article.summary,
      content: article.content,
      category: article.category,
      imageUrl: article.imageUrl,
    },
    live: snapshot ? {
      title: snapshot.title,
      summary: snapshot.summary,
      content: snapshot.content,
      category: snapshot.category,
      imageUrl: snapshot.imageUrl,
      publishedAt: snapshot.publishedAt,
    } : null,
    notice: req.query.notice === 'published' ? 'Article approved and published.'
      : req.query.notice === 'returned' ? 'Article returned to the reporter.' : '',
  });
}

async function reviewArticle(req, res) {
  const article = await findArticle(req.params.id);
  if (article.status !== 'pending') throw httpError(409, 'Only pending articles can be reviewed.');

  if (req.body.decision === 'approve') {
    article.approveAndPublish();
    await article.save();
    return res.redirect(`/editor/${article._id}?notice=published`);
  }

  if (req.body.decision === 'return') {
    const note = String(req.body.editorNote || '').trim();
    if (!note) throw httpError(400, 'Add a note explaining what the reporter should revise.');
    if (note.length > 1000) throw httpError(400, 'Editor notes are limited to 1000 characters.');
    article.returnToReporter(note);
    await article.save();
    return res.redirect(`/editor/${article._id}?notice=returned`);
  }

  throw httpError(400, 'Choose whether to approve or return this article.');
}

async function showEditForm(req, res) {
  const article = await findArticle(req.params.id);
  return res.render('article-form', {
    title: 'Edit article',
    currentUser: req.user,
    article,
    articleRaw: article,
    categories: CATEGORIES,
    mode: 'editor',
    actionUrl: `/editor/${article._id}/edit`,
    submitUrl: '',
    cancelUrl: `/editor/${article._id}`,
    locked: false,
    lockedReason: '',
    notice: req.query.notice === 'saved' ? 'Article changes saved.' : '',
  });
}

async function updateArticle(req, res) {
  const article = await findArticle(req.params.id);
  const values = parseArticleInput(req.body);
  Object.assign(article, values);

  if (article.status === 'published' && article.published) {
    article.published.title = values.title;
    article.published.summary = values.summary;
    article.published.content = values.content;
    article.published.imageUrl = values.imageUrl;
    article.published.category = values.category;
  }

  await article.save();
  return res.redirect(`/editor/${article._id}/edit?notice=saved`);
}

async function deleteArticle(req, res) {
  const article = await findArticle(req.params.id);
  if (article.published) throw httpError(409, 'Published articles cannot be deleted from the review queue.');
  await Article.deleteOne({ _id: article._id });
  return res.redirect('/editor?status=pending&notice=deleted');
}

async function showAnalytics(req, res) {
  const article = await findArticle(req.params.id);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 29);
  const grouped = await ArticleView.aggregate([
    { $match: { article: article._id, viewedAt: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$viewedAt', timezone: 'UTC' } }, views: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const counts = new Map(grouped.map((entry) => [entry._id, entry.views]));
  const dailyViews = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`, views: counts.get(key) || 0 };
  });

  return res.render('analytics', {
    title: 'Analytics Impact',
    currentUser: req.user,
    articleId: article._id.toString(),
    articleTitle: article.published?.title || article.title,
    totalViews: article.views || 0,
    periodViews: dailyViews.reduce((sum, item) => sum + item.views, 0),
    dailyViews,
    peakViews: Math.max(1, ...dailyViews.map((item) => item.views)),
  });
}

module.exports = { showDashboard, showReview, reviewArticle, showEditForm, updateArticle, deleteArticle, showAnalytics };