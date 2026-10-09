const form = document.getElementById('log-filter-form');
const rowsEl = document.getElementById('log-rows');
const countEl = document.getElementById('log-count');
const messageEl = document.getElementById('log-message');
const noLogsEl = document.getElementById('no-logs');
const pageLabelEl = document.getElementById('page-label');
const prevButton = document.getElementById('previous-page');
const nextButton = document.getElementById('next-page');
const sourceSelect = document.getElementById('source-filter');
const clearButton = document.getElementById('clear-log-filters');
const logDialog = document.getElementById('log-dialog');
const logDetails = document.getElementById('log-details');

let page = 1;
let hasMore = false;

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderRows(entries) {
  rowsEl.innerHTML = '';

  if (!entries || entries.length === 0) {
    noLogsEl.hidden = false;
    countEl.textContent = '0 entries';
    return;
  }

  noLogsEl.hidden = true;
  countEl.textContent = `${entries.length} shown`;

  for (const entry of entries) {
    const tr = document.createElement('tr');
    const cells = [
      escapeHtml(formatTimestamp(entry.timestamp)),
      `<span class="level-pill level-${escapeHtml(entry.level || 'info')}">${escapeHtml(entry.level || 'info')}</span>`,
      escapeHtml(entry.source || 'application'),
      escapeHtml(entry.message || ''),
      escapeHtml(entry.requestId || ''),
      escapeHtml(entry.userEmail || entry.userRole || ''),
    ];
    // Log text is escaped so it shows exactly as recorded, then DOMPurify cleans each cell before it is injected.
    for (const cell of cells) {
      const td = document.createElement('td');
      td.innerHTML = window.sanitize.html(cell);
      tr.appendChild(td);
    }

    tr.addEventListener('click', () => {
      logDetails.textContent = JSON.stringify(entry, null, 2);
      logDialog.showModal();
    });

    rowsEl.appendChild(tr);
  }
}

async function loadLogs() {
  const params = new URLSearchParams(new FormData(form));
  params.set('page', String(page));
  params.set('limit', '50');

  messageEl.textContent = 'Loading logs…';
  messageEl.hidden = false;

  try {
    const response = await fetch(`/api/admin/logs?${params.toString()}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const payload = await response.json();

    renderRows(payload.data || []);
    hasMore = !!payload.hasMore;
    pageLabelEl.textContent = `Page ${payload.page || 1}`;
    prevButton.disabled = (payload.page || 1) <= 1;
    nextButton.disabled = !hasMore;
    messageEl.textContent = payload.total ? `Showing ${payload.total} total log entries.` : 'No log entries found.';
  } catch (error) {
    messageEl.textContent = 'Logs could not be loaded right now.';
    rowsEl.innerHTML = '';
    noLogsEl.hidden = false;
    countEl.textContent = '0 entries';
    console.error(error);
  }
}

async function populateSources() {
  try {
    const response = await fetch('/api/admin/logs?limit=1', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const payload = await response.json();
    const sources = payload.sources || [];
    const currentValue = sourceSelect.value;
    sourceSelect.replaceChildren(new Option('All sources', ''), ...sources.map((source) => {
      const name = window.sanitize.text(source);
      return new Option(name, name);
    }));
    if (currentValue) sourceSelect.value = currentValue;
  } catch (error) {
    console.error('Failed to load source options', error);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  page = 1;
  loadLogs();
});

prevButton.addEventListener('click', () => {
  if (page <= 1) return;
  page -= 1;
  loadLogs();
});

nextButton.addEventListener('click', () => {
  if (!hasMore) return;
  page += 1;
  loadLogs();
});

clearButton.addEventListener('click', () => {
  form.reset();
  page = 1;
  loadLogs();
});

if (logDialog && logDialog.querySelector('form')) {
  logDialog.querySelector('form').addEventListener('click', () => logDialog.close());
}

populateSources().catch(() => {});
loadLogs();
