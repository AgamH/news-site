/**
 * The Daily Bugle - reporter article form autosave. Vanilla JS, no dependencies.
 *
 * The working copy is saved to the server shortly after the reporter stops typing, so
 * closing the browser, refreshing, or moving to another computer never loses work.
 *
 *   POST /api/reporter/articles        first save of a new article -> 201 { id, savedAt }
 *   PUT  /api/reporter/articles/:id    every save after that       -> 200 { id, savedAt }
 *     400 / 401 / 403 / 404 / 409 / 5xx -> { message: 'text that is safe to show the user' }
 */
(() => {
  'use strict';

  const form = document.getElementById('article-form');
  const status = document.getElementById('autosave-status');
  if (!form || !status || form.dataset.locked) return;

  const SAVE_DELAY_MS = 1500;
  const RETRY_DELAY_MS = 5000;
  const API_BASE = '/api/reporter/articles';
  const FIELDS = ['title', 'summary', 'category', 'imageUrl', 'content'];
  const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

  let articleId = form.dataset.articleId || '';
  let timer = null;
  let inFlight = null; // the pending save request, if any
  let stopped = false; // set once the server says this article can no longer be autosaved
  let leaving = false; // set when the form is being submitted the normal way

  function readFields() {
    return Object.fromEntries(FIELDS.map((name) => [name, form.elements[name].value]));
  }

  const serialize = (values) => JSON.stringify(values);
  let savedState = serialize(readFields());

  function isBlank(values) {
    return !values.title.trim() && !values.summary.trim() && !values.content.trim();
  }

  function isDirty() {
    return serialize(readFields()) !== savedState;
  }

  function showStatus(text, state) {
    status.textContent = text;
    status.dataset.state = state || '';
  }

  /** Once a new article has an id, the page becomes its edit page: a refresh reloads the saved draft. */
  function adoptArticleId(id) {
    articleId = id;
    const editUrl = `/reporter/${id}/edit`;
    form.action = editUrl;
    form.dataset.mode = 'edit';
    form.dataset.articleId = id;
    window.history.replaceState(null, '', editUrl);
  }

  function schedule(delay) {
    window.clearTimeout(timer);
    if (stopped || leaving) return;
    timer = window.setTimeout(save, delay);
  }

  async function sendSave(values, { keepalive = false } = {}) {
    const response = await fetch(articleId ? `${API_BASE}/${articleId}` : API_BASE, {
      method: articleId ? 'PUT' : 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: serialize(values),
      keepalive,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error((payload && payload.message) || 'The draft could not be saved.');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function save() {
    window.clearTimeout(timer);
    if (stopped || leaving || inFlight || !isDirty()) return;
    const values = readFields();
    if (!articleId && isBlank(values)) return; // nothing worth creating a draft for yet

    const sentState = serialize(values);
    showStatus('Saving…', 'saving');
    inFlight = sendSave(values);

    try {
      const payload = await inFlight;
      savedState = sentState;
      if (!articleId && payload && payload.id) adoptArticleId(payload.id);
      const savedAt = new Date((payload && payload.savedAt) || Date.now());
      showStatus(`All changes saved at ${timeFmt.format(savedAt)}`, 'saved');
    } catch (error) {
      if (error.status === 401) {
        // Not stopped: typing again retries, which succeeds once the reporter is logged back in.
        showStatus('Not saved: your session has expired. Log in again in another tab, then keep typing.', 'error');
      } else if (error.status === 400) {
        showStatus(`Not saved: ${error.message}`, 'error'); // fixed by editing, which triggers a new save
      } else if (error.status && error.status < 500) {
        stopped = true; // 403 / 404 / 409: retrying cannot help
        showStatus(`Autosave stopped: ${error.message}`, 'error');
      } else {
        showStatus('Could not reach the server. Retrying…', 'error');
        inFlight = null;
        schedule(RETRY_DELAY_MS);
        return;
      }
    } finally {
      inFlight = null;
    }

    if (isDirty() && !stopped && status.dataset.state === 'saved') schedule(SAVE_DELAY_MS); // typed during the request
  }

  form.addEventListener('input', () => {
    if (stopped || leaving) return;
    showStatus('Unsaved changes…', 'pending');
    schedule(SAVE_DELAY_MS);
  });

  // Last-chance save when the tab is hidden or closed. keepalive lets the request outlive the page.
  function flush() {
    if (stopped || leaving || inFlight || !articleId || !isDirty()) return;
    window.clearTimeout(timer);
    const values = readFields();
    const sentState = serialize(values);
    sendSave(values, { keepalive: true })
      .then(() => { savedState = sentState; })
      .catch(() => { schedule(RETRY_DELAY_MS); });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('online', () => { if (isDirty()) schedule(0); });

  // "Save" and "Submit" still post the form normally. If the first autosave of a new article
  // is still on its way, wait for it so the post updates that draft instead of creating a second one.
  form.addEventListener('submit', (event) => {
    window.clearTimeout(timer);
    if (inFlight && !articleId) {
      event.preventDefault();
      const submitter = event.submitter;
      inFlight.catch(() => {}).then(() => window.setTimeout(() => form.requestSubmit(submitter), 0));
      return;
    }
    leaving = true;
  });

  showStatus(articleId ? 'Changes are saved automatically as you type.' : 'Your draft will be saved automatically once you start typing.', '');
})();
