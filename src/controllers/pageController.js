const mongoose = require('mongoose');
const { Article } = require('../models/articleModel');
const { Comment } = require('../models/commentModel');
const { toCard, PAGE_SIZE, recordView } = require('./articleController');
const { showLogDashboard } = require('./adminLogController');

async function showHomePage(req, res) {
  const [articles, total] = await Promise.all([
    Article.find({ 'published.publishedAt': { $ne: null } })
      .sort({ 'published.publishedAt': -1, _id: -1 })
      .limit(PAGE_SIZE),
    Article.countDocuments({ 'published.publishedAt': { $ne: null } }),
  ]);
  return res.render('index', {
    title: 'The Daily Web',
    articles: articles.map(toCard),
    total,
    currentUser: req.user ? req.user.toJSON() : null,
  });
}

async function showArticlePage(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Article not found.');
  const article = await Article.findOne({ _id: req.params.id, 'published.publishedAt': { $ne: null } });
  if (!article) return res.status(404).send('Article not found.');

  await Promise.all([
    Article.updateOne({ _id: article._id }, { $inc: { views: 1 } }),
    recordView(article._id),
  ]);

  const comments = await Comment.find({ article: article._id }).sort({ createdAt: 1 }).lean();

  return res.render('article', {
    title: article.published.title,
    currentUser: req.user ? req.user.toJSON() : null,
    article: { ...toCard(article), content: article.published.content },
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
  if (!['reporter', 'editor'].includes(req.params.role)) return res.redirect('/register/reporter');
  const role = req.params.role === 'editor' ? 'editor' : 'reporter';
  return res.render('register', { title: `Create ${role} account`, role });
}

module.exports = { showHomePage, showArticlePage, showLoginPage, showRegistrationPage, showLogDashboard };