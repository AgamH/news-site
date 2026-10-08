const mongoose = require('mongoose');
const { Article, CATEGORIES } = require('../models/articleModel');
const { ArticleView } = require('../models/articleViewModel');
const { toWorkflowCard, PAGE_SIZE } = require('./articleController');
const { validateArticleInput } = require('../utils/articleValidation');

const DASHBOARD_STATUSES = ['pending', 'draft', 'published', 'returned'];

async function showDashboard(req, res) {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const status = DASHBOARD_STATUSES.includes(req.query.status) ? req.query.status : 'pending';
  const filter = { status };
  const [articles, total] = await Promise.all([
    Article.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
    Article.countDocuments(filter),
  ]);
  return res.render('editor-dashboard', {
    title: 'Editor desk',
    currentUser: req.user.toJSON(),
    articles: articles.map(toWorkflowCard),
    total,
    page,
    pages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
    statusFilter: status,
    statuses: DASHBOARD_STATUSES,
  });
}

async function showReview(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Article not found.');
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).send('Article not found.');

  return res.render('editor-review', {
    title: 'Review article',
    currentUser: req.user.toJSON(),
    article: toWorkflowCard(article),
    draft: {
      title: article.title,
      summary: article.summary,
      content: article.content,
      category: article.category,
      imageUrl: article.imageUrl,
    },
    live: article.published,
  });
}

async function showEditForm(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Article not found.');
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).send('Article not found.');

  return res.render('article-form', {
    title: 'Edit article (editor)',
    currentUser: req.user.toJSON(),
    categories: CATEGORIES,
    article: toWorkflowCard(article),
    articleRaw: article,
    mode: 'edit',
    actionUrl: `/api/editor/articles/${article.id}`,
    submitUrl: '',
    cancelUrl: `/editor/${article.id}`,
    locked: false,
    lockedReason: '',
  });
}

async function showAnalytics(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Article not found.');
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).send('Article not found.');

  return res.render('analytics', {
    title: 'Analytics impact',
    currentUser: req.user.toJSON(),
    articleId: article.id,
    articleTitle: article.title,
  });
}

async function updateArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    // 
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).json({ message: 'Article not found.' });

  const { errors, data } = validateArticleInput(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  Object.assign(article, data);
  await article.save();
  return res.json(toWorkflowCard(article));
}

async function approveArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).json({ message: 'Article not found.' });

  try {
    article.approveAndPublish();
  } catch (error) {
    return res.status(error.statusCode || 409).json({ message: error.message });
  }
  await article.save();
  return res.json(toWorkflowCard(article));
}

async function returnArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).json({ message: 'Article not found.' });

  const note = String(req.body.note || '').trim();
  if (!note) return res.status(400).json({ message: 'A note explaining the requested fixes is required.' });

  try {
    article.returnToReporter(note);
  } catch (error) {
    return res.status(error.statusCode || 409).json({ message: error.message });
  }
  await article.save();
  return res.json(toWorkflowCard(article));
}

async function deleteArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findByIdAndDelete(req.params.id);
  if (!article) return res.status(404).json({ message: 'Article not found.' });
  await ArticleView.deleteMany({ article: article._id });
  return res.status(204).end();
}

async function getAnalyticsData(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findById(req.params.id).lean();
  if (!article) return res.status(404).json({ message: 'Article not found.' });

  const views = await ArticleView.find({ article: article._id }).select('viewedAt').lean();
  const buckets = new Map();
  for (const { viewedAt } of views) {
    const day = new Date(viewedAt).toISOString().slice(0, 10);
    buckets.set(day, (buckets.get(day) || 0) + 1);
  }
  const sortedDays = [...buckets.keys()].sort();
  const data = sortedDays.map((day) => ({ date: day, views: buckets.get(day) }));
  const publishEvents = (article.publishHistory || []).map((entry) => entry.publishedAt);

  return res.json({ buckets: data, publishEvents, totalViews: views.length });
}

module.exports = {
  showDashboard,
  showReview,
  showEditForm,
  showAnalytics,
  updateArticle,
  approveArticle,
  returnArticle,
  deleteArticle,
  getAnalyticsData,
};