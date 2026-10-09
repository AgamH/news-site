const mongoose = require('mongoose');
const { Article, ARTICLE_STATUSES, EDITABLE_STATUSES, CATEGORIES } = require('../models/articleModel');
const { parseArticleInput } = require('../utils/articleInput');
const { httpError } = require('../utils/httpError');

const PAGE_SIZE = 20;

function formNotice(value) {
  return ({
    saved: 'Draft saved.',
    submitted: 'Article submitted for editor approval.',
  })[value] || '';
}

async function showDashboard(req, res) {
  const reporterId = req.user.id;
  const requestedStatus = String(req.query.status || '');
  const statusFilter = ARTICLE_STATUSES.includes(requestedStatus) ? requestedStatus : '';
  const baseFilter = { reporter: reporterId };
  const filter = statusFilter ? { ...baseFilter, status: statusFilter } : baseFilter;
  const requestedPage = Number.parseInt(req.query.page, 10);

  const [total, statusCounts] = await Promise.all([
    Article.countDocuments(filter),
    Promise.all(ARTICLE_STATUSES.map((status) => Article.countDocuments({ ...baseFilter, status }))),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1));
  const articles = await Article.find(filter)
    .select('title category status editorNote published views updatedAt')
    .sort({ updatedAt: -1, _id: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean();

  return res.render('reporter-dashboard', {
    title: 'My articles',
    currentUser: req.user,
    articles: articles.map((article) => ({
      id: article._id.toString(),
      title: article.title,
      category: article.category,
      status: article.status,
      editorNote: article.editorNote,
      isLive: Boolean(article.published),
      views: article.views || 0,
      updatedAt: article.updatedAt,
    })),
    statusFilter,
    total,
    page,
    pages,
    notice: req.query.notice === 'submitted' ? 'Article submitted for editor approval.' : '',
    statusCounts: Object.fromEntries(ARTICLE_STATUSES.map((status, index) => [status, statusCounts[index]])),
  });
}

function showNewForm(req, res) {
  return res.render('article-form', {
    title: 'New article',
    currentUser: req.user,
    article: null,
    articleRaw: null,
    categories: CATEGORIES,
    mode: 'create',
    actionUrl: '/reporter/new',
    submitUrl: '/reporter/new',
    cancelUrl: '/reporter',
    locked: false,
    lockedReason: '',
    notice: formNotice(req.query.notice),
  });
}

async function showEditForm(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Article not found.');
  const article = await Article.findOne({ _id: req.params.id, reporter: req.user.id }).lean();
  if (!article) throw httpError(404, 'Article not found.');

  const locked = article.status === 'pending';
  return res.render('article-form', {
    title: 'Edit article',
    currentUser: req.user,
    article,
    articleRaw: article,
    categories: CATEGORIES,
    mode: 'edit',
    actionUrl: `/reporter/${article._id}/edit`,
    submitUrl: `/reporter/${article._id}/edit`,
    cancelUrl: '/reporter',
    locked,
    lockedReason: locked ? 'This article is pending editor review and cannot be changed.' : '',
    notice: formNotice(req.query.notice),
  });
}

async function createArticle(req, res) {
  const article = new Article({
    ...parseArticleInput(req.body),
    reporter: req.user.id,
    reporterName: req.user.name,
  });

  if (req.body.intent === 'submit') article.submitForApproval();
  await article.save();
  if (article.status === 'pending') return res.redirect('/reporter?status=pending&notice=submitted');
  return res.redirect(`/reporter/${article._id}/edit?notice=saved`);
}

async function updateArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Article not found.');
  const article = await Article.findOne({ _id: req.params.id, reporter: req.user.id });
  if (!article) throw httpError(404, 'Article not found.');
  if (!EDITABLE_STATUSES.includes(article.status)) {
    throw httpError(409, 'This article cannot be edited while it is pending review.');
  }

  Object.assign(article, parseArticleInput(req.body));
  if (req.body.intent === 'submit') article.submitForApproval();
  await article.save();
  if (article.status === 'pending') return res.redirect('/reporter?status=pending&notice=submitted');
  return res.redirect(`/reporter/${article._id}/edit?notice=saved`);
}

module.exports = { showDashboard, showNewForm, showEditForm, createArticle, updateArticle };
