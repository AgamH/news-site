const { CATEGORIES } = require('../models/articleModel');
const { httpError } = require('./httpError');

function parseArticleInput(body = {}) {
  const article = {
    title: String(body.title || '').trim(),
    summary: String(body.summary || '').trim(),
    content: String(body.content || '').trim(),
    category: String(body.category || '').trim(),
    imageUrl: String(body.imageUrl || '').trim(),
  };

  if (!article.title) throw httpError(400, 'Enter an article title.');
  if (article.title.length > 200) throw httpError(400, 'Titles are limited to 200 characters.');
  if (!article.summary) throw httpError(400, 'Enter an article summary.');
  if (article.summary.length > 400) throw httpError(400, 'Summaries are limited to 400 characters.');
  if (!article.content) throw httpError(400, 'Write the article before saving.');
  if (article.content.length > 100000) throw httpError(400, 'Article content is too long.');
  if (!CATEGORIES.includes(article.category)) throw httpError(400, 'Choose a valid article category.');

  if (article.imageUrl) {
    let imageUrl;
    try {
      imageUrl = new URL(article.imageUrl);
    } catch {
      throw httpError(400, 'Enter a valid image URL.');
    }
    if (!['http:', 'https:'].includes(imageUrl.protocol)) {
      throw httpError(400, 'Image URLs must use HTTP or HTTPS.');
    }
  }

  return article;
}

module.exports = { parseArticleInput };
