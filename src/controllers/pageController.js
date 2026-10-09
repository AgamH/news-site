const mongoose = require('mongoose');

const { Article } = require('../models/articleModel');
const { Comment } = require('../models/commentModel');
const { recordView } = require('../models/articleViewModel');
const { showLogDashboard } = require('./adminLogController');

const PAGE_SIZE = 20;

function toCard(article) {
  const published = article.published || {};

  return {
    id: article._id.toString(),
    title: published.title || article.title || 'Untitled article',
    summary: published.summary || article.summary || '',
    category: published.category || article.category || 'General',
    reporterName: article.reporterName || 'Daily Bugle Staff',
    imageUrl: published.imageUrl || '',
    publishedAt: published.publishedAt || null,
    views: article.views || 0,
  };
}

async function showHomePage(req, res) {
  const filter = { 'published.publishedAt': { $ne: null } };

  const [articles, total] = await Promise.all([
    Article.find(filter)
      .sort({ 'published.publishedAt': -1, _id: -1 })
      .limit(PAGE_SIZE)
      .exec(),
    Article.countDocuments(filter).exec(),
  ]);

  return res.render('index', {
    title: 'The Daily Bugle',
    articles: articles.map((article) => toCard(article)),
    total,
    currentUser: req.user
      ? (typeof req.user.toJSON === 'function'
          ? req.user.toJSON()
          : req.user)
      : null,
  });
}

async function showArticlePage(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).send('Article not found.');
  }

  const article = await Article.findOne({
    _id: req.params.id,
    'published.publishedAt': { $ne: null },
  }).exec();

  if (!article) {
    return res.status(404).send('Article not found.');
  }

  await Promise.all([
    Article.updateOne(
      { _id: article._id },
      { $inc: { views: 1 } }
    ).exec(),
    recordView(article._id),
  ]);

  const comments = await Comment.find({
    article: article._id,
  })
    .sort({ createdAt: 1 })
    .lean()
    .exec();

  return res.render('article', {
    title: article.published.title,
    currentUser: req.user
      ? (typeof req.user.toJSON === 'function'
          ? req.user.toJSON()
          : req.user)
      : null,
    article: {
      ...toCard(article),
      content: article.published.content || '',
    },
    comments: comments.map((comment) => ({
      id: comment._id.toString(),
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  });
}

function showLoginPage(_req, res) {
  return res.render('login', { title: 'Log in' });
}

function showRegistrationPage(req, res) {
  if (!['reporter', 'editor'].includes(req.params.role)) {
    return res.redirect('/register/reporter');
  }

  const role = req.params.role === 'editor' ? 'editor' : 'reporter';

  return res.render('register', {
    title: `Create ${role} account`,
    role,
  });
}

module.exports = {
  showHomePage,
  showArticlePage,
  showLoginPage,
  showRegistrationPage,
  showLogDashboard,
};