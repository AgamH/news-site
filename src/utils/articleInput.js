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

/**
 * Lenient version used by autosave: the reporter is still typing, so fields may be empty.
 * Length and category limits still apply. A half-typed image URL is left out of the
 * result, so the last valid one stays saved.
 */
function parseArticleDraft(body = {}) {
  const draft = {
    title: String(body.title || '').trim(),
    summary: String(body.summary || '').trim(),
    content: String(body.content || '').trim(),
    category: String(body.category || '').trim(),
  };

  if (draft.title.length > 200) throw httpError(400, 'Titles are limited to 200 characters.');
  if (draft.summary.length > 400) throw httpError(400, 'Summaries are limited to 400 characters.');
  if (draft.content.length > 100000) throw httpError(400, 'Article content is too long.');
  if (!CATEGORIES.includes(draft.category)) throw httpError(400, 'Choose a valid article category.');

  const imageUrl = String(body.imageUrl || '').trim();
  if (!imageUrl) {
    draft.imageUrl = '';
  } else {
    try {
      if (['http:', 'https:'].includes(new URL(imageUrl).protocol)) draft.imageUrl = imageUrl;
    } catch {
      // not a complete URL yet
    }
  }

  return draft;
}

module.exports = { parseArticleInput, parseArticleDraft };