const mongoose = require('mongoose');
const { Article, CATEGORIES } = require('../models/articleModel');
const { Comment, isRateLimited } = require('../models/commentModel');
const { recordView } = require('../models/articleViewModel');

const PAGE_SIZE = 20;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toCard(article) {
  const live = article.published;
  return {
    id: article._id.toString(),
    title: live.title,
    summary: live.summary,
    category: live.category,
    reporterName: article.reporterName,
    imageUrl: live.imageUrl || '',
    publishedAt: live.publishedAt,
    views: article.views,
  };
}

function toWorkflowCard(article) {
  return {
    id: article._id.toString(),
    title: article.title,
    summary: article.summary,
    category: article.category,
    status: article.status,
    editorNote: article.editorNote || '',
    reporterName: article.reporterName,
    reporterId: article.reporter.toString(),
    isLive: Boolean(article.published),
    views: article.views,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    publishedAt: article.published ? article.published.publishedAt : null,
  };
}

async function listPublishedArticles(req, res) {
  const filter = { 'published.publishedAt': { $ne: null } };

  if (req.query.q) {
    const pattern = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ 'published.title': pattern }, { 'published.summary': pattern }, { reporterName: pattern }];
  }
  if (req.query.category && CATEGORIES.includes(req.query.category)) {
    filter['published.category'] = req.query.category;
  }

  const sortField = req.query.sort === 'views' ? 'views' : 'published.publishedAt';
  const sortDirection = req.query.order === 'asc' ? 1 : -1;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

  const [articles, total] = await Promise.all([
    Article.find(filter)
      .sort({ [sortField]: sortDirection, _id: sortDirection })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    Article.countDocuments(filter),
  ]);

  return res.json({
    articles: articles.map(toCard),
    page,
    hasMore: page * PAGE_SIZE < total,
    total,
  });
}

async function getPublishedArticle(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findOne({ _id: req.params.id, 'published.publishedAt': { $ne: null } });
  if (!article) return res.status(404).json({ message: 'Article not found.' });
  return res.json({ ...toCard(article), content: article.published.content });
}

async function postComment(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Article ID must be a valid MongoDB ObjectId.' });
  }
  const article = await Article.findOne({ _id: req.params.id, 'published.publishedAt': { $ne: null } });
  if (!article) return res.status(404).json({ message: 'Article not found.' });

  if (await isRateLimited(req.deviceId)) {
    return res.status(429).json({ message: 'You can post at most 3 comments per minute. Please wait a moment and try again.' });
  }

  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ message: 'Comment text is required.' });

  const authorName = String(req.body.authorName || '').trim().slice(0, 60) || 'Guest';
  const comment = await Comment.create({ article: article._id, deviceId: req.deviceId, authorName, body: body.slice(0, 1000) });
  return res.status(201).json(comment.toJSON());
}

module.exports = {
  listPublishedArticles,
  getPublishedArticle,
  postComment,
  toCard,
  toWorkflowCard,
  recordView,
  PAGE_SIZE,
};