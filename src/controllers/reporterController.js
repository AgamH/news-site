const mongoose = require('mongoose');
const { Article, CATEGORIES, EDITABLE_STATUSES } = require('../models/articleModel');
const { toWorkflowCard, PAGE_SIZE } = require('./articleController');
const { validateArticleInput } = require('../utils/articleValidation');

async function showDashboard(req, res) {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const filter = { reporter: req.user._id };
  if (req.query.status && ['draft', 'pending', 'published', 'returned'].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  const [articles, total] = await Promise.all([
    Article.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
    Article.countDocuments(filter),
  ]);
  return res.render('reporter-dashboard', {
    title: 'My articles',
    currentUser: req.user.toJSON(),
    articles: articles.map(toWorkflowCard),
    total,
    page,
    pages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
    statusFilter: req.query.status || '',
  });
}

function showNewForm(req, res) {
  return res.render('article-form', {
    title: 'New article',
    currentUser: req.user.toJSON(),
    categories: CATEGORIES,
    article: null,
    mode: 'create',
    actionUrl: '/api/reporter/articles',
    cancelUrl: '/reporter',
    locked: false,
    lockedReason: '',
  });
}

async function showEditForm(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).render('article-form', notFoundProps(req));
  const article = await Article.findOne({ _id: req.params.id, reporter: req.user._id });
  if (!article) return res.status(404).render('article-form', notFoundProps(req));

  const locked = !EDITABLE_STATUSES.includes(article.status);
  return res.render('article-form', {
    title: 'Edit article',
    currentUser: req.user.toJSON(),
    categories: CATEGORIES,
    article: toWorkflowCard(article),
    articleRaw: article,
    mode: 'edit',
    actionUrl: `/api/reporter/articles/${article.id}`,
    submitUrl: `/api/reporter/articles/${article.id}/submit`,
    cancelUrl: '/reporter',
    locked,
    lockedReason: locked ? 'This article is awaiting editor review and cannot be edited right now.' : '',
  });
}

function notFoundProps(req) {
  return {
    title: 'Article not found',
    currentUser: req.user.toJSON(),
    categories: CATEGORIES,
    article: null,
    mode: 'missing',
    actionUrl: '',
    cancelUrl: '/reporter',
    locked: true,
    lockedReason: 'This article does not exist or does not belong to you.',
  };
}

async function createArticle(req, res) {
  const { errors, data } = validateArticleInput(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const article = await Article.create({
    ...data,
    imageUrl: data.imageUrl || '',
    status: 'draft',
    reporter: req.user._id,
    reporterName: req.user.name,
  });
  return res.status(201).json(toWorkflowCard(article));
}

async function updateArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findOne({ _id: req.params.id, reporter: req.user._id });
  if (!article) return res.status(404).json({ message: 'Article not found.' });
  if (!EDITABLE_STATUSES.includes(article.status)) {
    return res.status(409).json({ message: 'This article cannot be edited while it is pending review.' });
  }

  const { errors, data } = validateArticleInput(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  Object.assign(article, data);
  await article.save();
  return res.json(toWorkflowCard(article));
}

async function submitArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findOne({ _id: req.params.id, reporter: req.user._id });
  if (!article) return res.status(404).json({ message: 'Article not found.' });

  try {
    article.submitForApproval();
  } catch (error) {
    return res.status(error.statusCode || 409).json({ message: error.message });
  }
  await article.save();
  return res.json(toWorkflowCard(article));
}

module.exports = { showDashboard, showNewForm, showEditForm, createArticle, updateArticle, submitArticle };