/**
 * The Web Daily - home page (public feed). Vanilla JS, no dependencies.
 *
 * Endpoints (paths are set in views/index.ejs via window.HOME_CONFIG):
 *
 *   GET /api/articles?q=&category=&seen=all|seen|unseen&sort=newest|popular&page=1&limit=20
 *     -> { data: [{ _id, title, summary, imageUrl, category,
 *                   reporter: { name }, publishedAt, seen }],
 *          page, limit, total, hasMore }
 *     The server returns PUBLISHED articles only.
 *
 *   GET /api/weather
 *     -> { city, tempC, feelsLikeC, description, humidity, windKph, updatedAt }
 *     updatedAt = when the SERVER last fetched the data from the weather provider.
 */
(() => {
  'use strict';

  const config = window.HOME_CONFIG;
  if (!config) return;

  const $ = (selector, root = document) => root.querySelector(selector);

  const form = $('#feed-controls');
  const list = $('#story-list');
  const template = $('#story-template');
  const sentinel = $('#sentinel');
  const loader = $('#loader');
  const statusEl = $('#feed-status');
  const emptyState = $('#empty-state');
  const errorState = $('#feed-error');
  const errorText = $('#feed-error-text');
  const endMarker = $('#end-marker');
  const loadMoreBtn = $('#load-more');

  const DEFAULTS = { q: '', category: '', seen: 'all', sort: 'newest' };
  const SEARCH_DELAY_MS = 350;
  const SCROLL_LOOKAHEAD = '0px 0px 800px 0px'; // start loading ~800px before the bottom

  const dateFmt = new Intl.DateTimeFormat(config.locale, { dateStyle: 'medium', timeZone: config.timeZone });
  const timeFmt = new Intl.DateTimeFormat(config.locale, { timeStyle: 'short', timeZone: config.timeZone });

  /* ------------------------------------------------------------------ */
  /* Feed state                                                          */
  /* ------------------------------------------------------------------ */

  const state = {
    page: config.initial.page,
    total: config.initial.total,
    hasMore: config.initial.hasMore,
    filters: null, // filters of the list currently on screen (set below)
    loading: false,
    refreshing: false, // true while a filter change is being applied
    failed: false,
    retryReset: false,
    token: 0, // identifies the latest request; older responses are ignored
    controller: null,
    ids: new Set([...list.querySelectorAll('.story')].map((el) => el.dataset.id)),
  };

  /* ------------------------------------------------------------------ */
  /* Filters                                                             */
  /* ------------------------------------------------------------------ */

  function readFilters() {
    const data = new FormData(form);
    return {
      q: String(data.get('q') || '').trim().replace(/\s+/g, ' '),
      category: String(data.get('category') || ''),
      seen: String(data.get('seen') || DEFAULTS.seen),
      sort: String(data.get('sort') || DEFAULTS.sort),
    };
  }

  const sameFilters = (a, b) => Object.keys(DEFAULTS).every((key) => a[key] === b[key]);

  function toParams(filters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== DEFAULTS[key]) params.set(key, value);
    }
    return params;
  }

  /** Keep the address bar in step with the filters, so a refresh or a shared link shows the same list. */
  function syncUrl(filters) {
    const query = toParams(filters).toString();
    history.replaceState(null, '', query ? `${location.pathname}?${query}` : location.pathname);
  }

  state.filters = readFilters();

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  // Must match hueOf() in views/index.ejs so a category has the same colour on server and client.
  function hueOf(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }

  function formatDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : { iso: d.toISOString(), text: dateFmt.format(d) };
  }

  /** Builds a story from the <template>. Only textContent/href/src are set, so article text can never inject HTML. */
  function buildCard(article, id) {
    const card = template.content.firstElementChild.cloneNode(true);
    const field = (name) => card.querySelector(`[data-f="${name}"]`);
    const category = String(article.category || '');

    card.dataset.id = id;
    card.style.setProperty('--h', hueOf(category));
    card.classList.toggle('is-seen', Boolean(article.seen));

    const title = field('title');
    title.textContent = article.title || 'Untitled';
    title.href = config.articleUrl + encodeURIComponent(id);

    const categoryLink = field('category');
    categoryLink.textContent = category;
    categoryLink.href = `/?category=${encodeURIComponent(category)}`;
    categoryLink.closest('.story-category').hidden = !category;

    field('summary').textContent = article.summary || '';
    field('reporter').textContent = (article.reporter && article.reporter.name) || 'Staff';

    const time = field('date');
    const date = article.publishedAt ? formatDate(article.publishedAt) : null;
    time.hidden = !date;
    if (date) {
      time.dateTime = date.iso;
      time.textContent = date.text;
    }

    field('flag').hidden = !article.seen;

    const media = field('media');
    media.dataset.initial = category.charAt(0).toUpperCase();
    if (article.imageUrl) {
      field('image').src = article.imageUrl;
    } else {
      field('image').remove();
      media.classList.add('is-missing');
    }

    return card;
  }

  function updateUi() {
    const count = state.ids.size;
    const busy = state.loading;

    list.setAttribute('aria-busy', String(busy));
    list.classList.toggle('is-refreshing', busy && state.refreshing);
    loader.hidden = !busy;
    errorState.hidden = !state.failed;
    emptyState.hidden = !(count === 0 && !busy && !state.failed);
    endMarker.hidden = !(count > 0 && !state.hasMore && !busy && !state.failed);
    loadMoreBtn.hidden = !(!observer && state.hasMore && !busy && !state.failed);

    if (busy && state.refreshing) {
      statusEl.textContent = 'Loading stories';
    } else if (state.failed) {
      statusEl.textContent = '';
    } else if (count === 0) {
      statusEl.textContent = 'No stories found';
    } else {
      statusEl.textContent = `Showing ${count} of ${Math.max(state.total, count)} ${state.total === 1 ? 'story' : 'stories'}`;
    }
  }

  function messageFor(error) {
    if (error instanceof TypeError) return 'Could not reach the server. Check your connection and try again.';
    return error.message || 'Something went wrong. Try again.';
  }

  /* ------------------------------------------------------------------ */
  /* Loading                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * reset = true  -> start a new list from page 1 using the current form values
   * reset = false -> append the next page of the list already on screen
   */
  async function load({ reset = false } = {}) {
    if (!reset && (state.loading || !state.hasMore || state.failed)) return;

    if (reset) {
      if (state.controller) state.controller.abort();
      state.filters = readFilters();
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'auto' });
    }

    const token = ++state.token;
    const controller = new AbortController();
    state.controller = controller;
    state.loading = true;
    state.refreshing = reset;
    state.failed = false;
    updateUi();

    // "Load more" always uses the filters of the list on screen, never half-typed form values.
    const params = toParams(state.filters);
    params.set('page', reset ? 1 : state.page + 1);
    params.set('limit', config.pageSize);

    try {
      const response = await fetch(`${config.articlesApi}?${params}`, {
        signal: controller.signal,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((body && body.message) || `The server returned an error (${response.status}). Try again.`);
      }
      if (!body || !Array.isArray(body.data)) throw new Error('The server sent an unexpected response.');

      if (token !== state.token) return; // a newer request replaced this one

      if (reset) {
        list.replaceChildren();
        state.ids.clear();
        syncUrl(state.filters);
      }

      const fragment = document.createDocumentFragment();
      for (const article of body.data) {
        const id = String(article._id ?? article.id ?? '');
        if (!id || state.ids.has(id)) continue; // skip repeats if the list shifted while scrolling
        state.ids.add(id);
        fragment.append(buildCard(article, id));
      }
      list.append(fragment);

      state.page = Number(body.page) || (reset ? 1 : state.page + 1);
      state.total = Number.isFinite(body.total) ? body.total : state.ids.size;
      state.hasMore = Boolean(body.hasMore);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (token !== state.token) return;

      if (reset) {
        list.replaceChildren();
        state.ids.clear();
        state.total = 0;
        state.hasMore = false;
      }
      state.failed = true;
      state.retryReset = reset;
      errorText.textContent = messageFor(error);
    } finally {
      if (token === state.token) {
        state.loading = false;
        state.refreshing = false;
        updateUi();
        // If the sentinel is still on screen (tall window, few results) fetch the next page too.
        if (state.hasMore && !state.failed) watchAgain();
      }
    }
  }

  /* Infinite scroll: an invisible sentinel below the list tells us when the reader is close to the end. */
  let observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: SCROLL_LOOKAHEAD }
    );
    observer.observe(sentinel);
  }

  function watchAgain() {
    if (!observer) return;
    observer.unobserve(sentinel); // re-observing makes the browser report the current state again
    observer.observe(sentinel);
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  let searchTimer = 0;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearTimeout(searchTimer);
    load({ reset: true });
  });

  // Search-as-you-type, debounced so we do not send a request per keystroke.
  form.elements.q.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (!sameFilters(readFilters(), state.filters)) load({ reset: true });
    }, SEARCH_DELAY_MS);
  });

  // Category, viewed status and sort apply immediately.
  form.addEventListener('change', (event) => {
    if (event.target.name === 'q') return;
    clearTimeout(searchTimer);
    load({ reset: true });
  });

  // Clicking a category label on a story filters the feed instead of leaving the page.
  list.addEventListener('click', (event) => {
    const link = event.target.closest('.story-category a');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const category = new URL(link.href, location.origin).searchParams.get('category') || '';
    if (!Array.from(form.elements.category).some((radio) => radio.value === category)) return;
    event.preventDefault();
    form.elements.category.value = category;
    load({ reset: true });
  });

  // A story image that fails to load falls back to the coloured placeholder.
  list.addEventListener(
    'error',
    (event) => {
      if (event.target.tagName !== 'IMG') return;
      const media = event.target.closest('.story-media');
      event.target.remove();
      if (media) media.classList.add('is-missing');
    },
    true
  );

  $('#clear-filters').addEventListener('click', () => {
    form.elements.q.value = DEFAULTS.q;
    form.elements.category.value = DEFAULTS.category;
    form.elements.seen.value = DEFAULTS.seen;
    form.elements.sort.value = DEFAULTS.sort;
    load({ reset: true });
  });

  $('#retry').addEventListener('click', () => {
    state.failed = false;
    load({ reset: state.retryReset });
  });

  loadMoreBtn.addEventListener('click', () => load());

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
        statusEl.textContent = 'Could not log out. Try again.';
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Weather widget                                                      */
  /* ------------------------------------------------------------------ */

  const weatherEl = $('#weather');
  const WEATHER_REFRESH_MS = 5 * 60 * 1000; // the server also caches for 5 min, so data is at most ~10 min old
  const WEATHER_MAX_AGE_MS = 15 * 60 * 1000; // never show a reading older than this
  let weatherUpdatedAt = 0;

  function weatherField(name) {
    return weatherEl.querySelector(`[data-w="${name}"]`);
  }

  function showWeather(data) {
    const number = (value) => (Number.isFinite(value) ? String(Math.round(value)) : '--');
    weatherField('city').textContent = data.city || '';
    weatherField('temp').textContent = number(data.tempC);
    weatherField('description').textContent = data.description || '';
    weatherField('feels').textContent = number(data.feelsLikeC);
    weatherField('humidity').textContent = number(data.humidity);
    weatherField('wind').textContent = number(data.windKph);

    const updated = new Date(data.updatedAt);
    const time = weatherField('updated');
    if (Number.isNaN(updated.getTime())) {
      time.textContent = '--:--';
    } else {
      time.textContent = timeFmt.format(updated);
      time.dateTime = updated.toISOString();
    }
    weatherField('body').hidden = false;
    weatherField('error').hidden = true;
  }

  function showWeatherError() {
    weatherField('body').hidden = true;
    weatherField('error').hidden = false;
  }

  async function loadWeather() {
    if (!weatherEl) return;
    weatherEl.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(config.weatherApi, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`weather ${response.status}`);
      const data = await response.json();

      const fetchedAt = Date.parse(data.updatedAt);
      if (Number.isFinite(fetchedAt) && Date.now() - fetchedAt > WEATHER_MAX_AGE_MS) throw new Error('weather data too old');

      showWeather(data);
      weatherUpdatedAt = Date.now();
    } catch {
      // Keep the last good reading only while it is still fresh enough; otherwise say it is unavailable.
      if (Date.now() - weatherUpdatedAt > WEATHER_MAX_AGE_MS) showWeatherError();
    } finally {
      weatherEl.setAttribute('aria-busy', 'false');
    }
  }

  if (weatherEl) {
    $('#weather-retry').addEventListener('click', loadWeather);
    loadWeather();
    setInterval(loadWeather, WEATHER_REFRESH_MS);
    // Browsers slow timers in background tabs, so refresh when the reader comes back.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - weatherUpdatedAt > WEATHER_REFRESH_MS) loadWeather();
    });
  }

  updateUi();
})();
