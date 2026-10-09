(() => {
  'use strict';

  const config = window.ARTICLE_CONFIG;
  if (!config) return;

  const $ = (selector) => document.querySelector(selector);
  const form = $('#comment-form');
  if (!form) return;

  const nameInput = $('#comment-name');
  const bodyInput = $('#comment-body');
  const submitButton = $('#comment-submit');
  const message = $('#comment-message');
  const list = $('#comment-list');
  const emptyState = $('#comment-empty');
  const countEl = $('#comment-count');

  const dateTimeFmt = new Intl.DateTimeFormat(config.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: config.timeZone });
  const SUBMIT_LABEL = submitButton.textContent;
  let submitting = false;

  function setBusy(busy) {
    submitting = busy;
    submitButton.disabled = busy;
    submitButton.textContent = busy ? 'Posting' : SUBMIT_LABEL;
  }

  function showMessage(text, { success = false } = {}) {
    message.textContent = text;
    message.classList.toggle('is-success', success);
  }

  function updateCount() {
    countEl.textContent = `(${list.querySelectorAll('.comment').length})`;
  }

  /** Builds a comment <li> the same way the server renders one in views/article.ejs. */
  function buildCommentItem(comment) {
    const item = document.createElement('li');
    item.className = 'comment is-new';
    item.dataset.id = comment.id;

    const meta = document.createElement('p');
    meta.className = 'comment-meta';
    const author = document.createElement('strong');
    author.textContent = comment.authorName || 'Guest';
    const time = document.createElement('time');
    const created = new Date(comment.createdAt);
    if (!Number.isNaN(created.getTime())) {
      time.dateTime = created.toISOString();
      time.textContent = dateTimeFmt.format(created);
    }
    meta.append(author, ' ', time);

    const body = document.createElement('p');
    body.className = 'comment-body';
    body.textContent = comment.body; // textContent only: never interpret a comment's text as HTML

    item.append(meta, body);
    return item;
  }

  function messageFor(status, serverMessage) {
    if (serverMessage) return serverMessage;
    if (status === 429) return 'You are posting comments too quickly. Please wait a bit and try again.';
    if (status === 404) return 'This article is no longer available.';
    return 'The server had a problem. Try again in a moment.';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    const body = bodyInput.value.trim();
    if (!body) {
      showMessage('Write something before posting.');
      bodyInput.focus();
      return;
    }

    showMessage('');
    setBusy(true);

    try {
      const response = await fetch(config.commentsApi, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ authorName: nameInput.value.trim(), body }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(messageFor(response.status, payload && payload.message));
        throw error;
      }
      if (!payload || !payload.comment) throw new Error('The server sent an unexpected response.');

      list.prepend(buildCommentItem(payload.comment));
      emptyState.hidden = true;
      updateCount();
      bodyInput.value = '';
      nameInput.value = '';
      showMessage('Comment posted.', { success: true });
    } catch (error) {
      showMessage(error instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : error.message);
    } finally {
      setBusy(false);
    }
  });

  const logoutButton = $('#logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;
      try {
        const response = await fetch(config.logoutApi, { method: 'POST', credentials: 'same-origin' });
        if (!response.ok) throw new Error('logout failed');
        window.location.reload();
      } catch {
        logoutButton.disabled = false;
      }
    });
  }
})();
