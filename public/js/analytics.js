/**
 * The Daily Bugle - editor Analytics Impact chart. Vanilla JS + <canvas>, no dependencies.
 *
 *   GET /api/editor/articles/:id/analytics?range=24h|7d|30d
 *     200 -> { range, rangeLabel, bucketMs, start, end, buckets: [{ t, views }], periodViews, totalViews,
 *              publications: [{ t, isUpdate, number, inRange, windowMs?, before?, after? }] }
 *     401 / 403 / 404 / 5xx -> { message: 'text that is safe to show the user' }
 *
 * All times are epoch milliseconds. Buckets are aligned to UTC hours (24h, 7d) or UTC days (30d).
 */
(() => {
  'use strict';

  const root = document.getElementById('analytics');
  const canvas = document.getElementById('analytics-chart');
  if (!root || !canvas || !canvas.getContext) return;

  const $ = (id) => document.getElementById(id);
  const wrap = $('analytics-chart-wrap');
  const tooltip = $('analytics-tooltip');
  const message = $('analytics-message');
  const impactBody = $('analytics-impact');
  const rangeButtons = Array.from(document.querySelectorAll('.analytics-range'));
  const ctx = canvas.getContext('2d');

  const HOUR_MS = 60 * 60 * 1000;
  const COLORS = { line: '#c91d25', area: 'rgba(201, 29, 37, 0.1)', marker: '#171717', grid: '#e6e0d6', axis: '#595959', surface: '#ffffff' };
  const MARGIN = { top: 44, right: 16, bottom: 34, left: 44 };
  const HEIGHT = 320;
  const FONT = '12px Arial, sans-serif';

  const fmt = (options) => new Intl.DateTimeFormat(undefined, options);
  const hourFmt = fmt({ hour: '2-digit', minute: '2-digit' });
  const dayFmt = fmt({ weekday: 'short', day: 'numeric' });
  const utcDayFmt = fmt({ month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dateTimeFmt = fmt({ dateStyle: 'medium', timeStyle: 'short' });
  const dayHourFmt = fmt({ weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  let data = null;
  let hoverIndex = -1;
  let layout = null; // pixel geometry of the last draw, used by the hover handlers

  const publicationName = (publication) => (publication.isUpdate ? `Update ${publication.number}` : 'First published');

  function niceMax(value) {
    if (value <= 4) return 4;
    const step = 10 ** Math.floor(Math.log10(value));
    const scaled = value / step;
    return (scaled <= 2 ? 2 : scaled <= 4 ? 4 : scaled <= 8 ? 8 : 10) * step;
  }

  /** X-axis tick positions and labels, chosen per range so labels never crowd. */
  function timeTicks() {
    const ticks = [];
    const end = data.start + data.buckets.length * data.bucketMs;
    if (data.bucketMs > HOUR_MS) {
      for (let t = data.start; t < end; t += 5 * data.bucketMs) ticks.push({ t, label: utcDayFmt.format(t) });
      return ticks;
    }
    const daily = data.buckets.length > 48;
    const cursor = new Date(data.start);
    cursor.setMinutes(0, 0, 0);
    for (; cursor.getTime() < end; cursor.setHours(cursor.getHours() + 1)) {
      const t = cursor.getTime();
      if (t < data.start) continue;
      if (daily ? cursor.getHours() === 0 : cursor.getHours() % 3 === 0) {
        ticks.push({ t, label: daily ? dayFmt.format(t) : hourFmt.format(t) });
      }
    }
    return ticks;
  }

  function draw() {
    if (!data) return;
    const width = wrap.clientWidth;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(HEIGHT * ratio);
    canvas.style.height = `${HEIGHT}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    ctx.font = FONT;

    const plot = { left: MARGIN.left, right: width - MARGIN.right, top: MARGIN.top, bottom: HEIGHT - MARGIN.bottom };
    const spanMs = data.buckets.length * data.bucketMs;
    const yMax = niceMax(Math.max(...data.buckets.map((bucket) => bucket.views)));
    const x = (t) => plot.left + ((t - data.start) / spanMs) * (plot.right - plot.left);
    const y = (views) => plot.bottom - (views / yMax) * (plot.bottom - plot.top);
    const points = data.buckets.map((bucket) => ({ x: x(bucket.t + data.bucketMs / 2), y: y(bucket.views) }));
    layout = { plot, points };

    // Grid and y axis
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let step = 0; step <= 4; step += 1) {
      const value = (yMax / 4) * step;
      const py = Math.round(y(value)) + 0.5;
      ctx.strokeStyle = step === 0 ? COLORS.axis : COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(plot.left, py);
      ctx.lineTo(plot.right, py);
      ctx.stroke();
      ctx.fillStyle = COLORS.axis;
      ctx.fillText(String(value), plot.left - 8, py);
    }

    // X axis
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    let lastLabelRight = -Infinity;
    timeTicks().forEach((tick) => {
      const px = x(tick.t);
      const half = ctx.measureText(tick.label).width / 2;
      if (px - half < lastLabelRight + 8 || px + half > width) return;
      ctx.strokeStyle = COLORS.axis;
      ctx.beginPath();
      ctx.moveTo(Math.round(px) + 0.5, plot.bottom);
      ctx.lineTo(Math.round(px) + 0.5, plot.bottom + 5);
      ctx.stroke();
      ctx.fillStyle = COLORS.axis;
      ctx.fillText(tick.label, px, plot.bottom + 9);
      lastLabelRight = px + half;
    });

    // Views: area + line
    ctx.beginPath();
    ctx.moveTo(points[0].x, plot.bottom);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, plot.bottom);
    ctx.closePath();
    ctx.fillStyle = COLORS.area;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    if (points.length <= 31) {
      points.forEach((point) => dot(point, 3));
    }

    // Publication markers: a dashed line across the plot at the exact approval time, labelled on top
    const rowRight = [-Infinity, -Infinity];
    ctx.textBaseline = 'middle';
    data.publications.filter((publication) => publication.inRange).forEach((publication) => {
      const px = Math.round(x(publication.t)) + 0.5;
      const label = publicationName(publication);
      const labelWidth = ctx.measureText(label).width + 12;
      const labelLeft = Math.min(Math.max(px - labelWidth / 2, 0), width - labelWidth);
      const row = labelLeft > rowRight[0] + 4 ? 0 : 1;
      rowRight[row] = labelLeft + labelWidth;
      const labelTop = 2 + row * 20;

      ctx.strokeStyle = COLORS.marker;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(px, labelTop + 18);
      ctx.lineTo(px, plot.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.marker;
      ctx.fillRect(labelLeft, labelTop, labelWidth, 18);
      ctx.fillStyle = COLORS.surface;
      ctx.textAlign = 'left';
      ctx.fillText(label, labelLeft + 6, labelTop + 9.5);
    });

    // Hover crosshair
    if (hoverIndex >= 0 && points[hoverIndex]) {
      const point = points[hoverIndex];
      ctx.strokeStyle = COLORS.axis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(point.x) + 0.5, plot.top);
      ctx.lineTo(Math.round(point.x) + 0.5, plot.bottom);
      ctx.stroke();
      dot(point, 5);
    }
  }

  function dot(point, radius) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.line;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.surface;
    ctx.stroke();
  }

  function bucketLabel(bucket) {
    if (data.bucketMs > HOUR_MS) return `${utcDayFmt.format(bucket.t)} (UTC day)`;
    return `${dayHourFmt.format(bucket.t)} – ${hourFmt.format(bucket.t + data.bucketMs)}`;
  }

  function line(className, text) {
    const element = document.createElement('p');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function setHover(index) {
    if (!data || !layout) return;
    hoverIndex = index;
    draw();
    if (index < 0) {
      tooltip.hidden = true;
      return;
    }
    const bucket = data.buckets[index];
    const point = layout.points[index];
    tooltip.replaceChildren(
      line('analytics-tooltip-time', bucketLabel(bucket)),
      line('analytics-tooltip-value', `${bucket.views} ${bucket.views === 1 ? 'view' : 'views'}`),
      ...data.publications
        .filter((publication) => publication.t >= bucket.t && publication.t < bucket.t + data.bucketMs)
        .map((publication) => line('analytics-tooltip-update', `${publicationName(publication)} · approved ${hourFmt.format(publication.t)}`)),
    );
    tooltip.hidden = false;
    const left = Math.min(Math.max(point.x - tooltip.offsetWidth / 2, 0), wrap.clientWidth - tooltip.offsetWidth);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(point.y - tooltip.offsetHeight - 12, 0)}px`;
  }

  function nearestIndex(clientX) {
    const px = clientX - canvas.getBoundingClientRect().left;
    let best = 0;
    layout.points.forEach((point, index) => {
      if (Math.abs(point.x - px) < Math.abs(layout.points[best].x - px)) best = index;
    });
    return best;
  }

  canvas.addEventListener('pointermove', (event) => { if (layout) setHover(nearestIndex(event.clientX)); });
  canvas.addEventListener('pointerleave', () => setHover(-1));
  canvas.addEventListener('blur', () => setHover(-1));
  canvas.addEventListener('keydown', (event) => {
    if (!data || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const last = data.buckets.length - 1;
    const from = hoverIndex < 0 ? last : hoverIndex;
    setHover(Math.min(last, Math.max(0, from + (event.key === 'ArrowRight' ? 1 : -1))));
  });

  function windowLabel(windowMs) {
    const hours = windowMs / HOUR_MS;
    if (hours >= 1) return `${Math.round(hours)} h before / after`;
    return `${Math.max(1, Math.round(windowMs / 60000))} min before / after`;
  }

  function changeLabel(before, after) {
    const diff = after - before;
    if (diff === 0) return 'No change';
    const sign = diff > 0 ? '▲ +' : '▼ −';
    const percent = before > 0 ? ` (${diff > 0 ? '+' : '−'}${Math.round((Math.abs(diff) / before) * 100)}%)` : '';
    return `${sign}${Math.abs(diff)}${percent}`;
  }

  function cell(text, className) {
    const element = document.createElement('td');
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function renderImpact() {
    const rows = data.publications.slice().reverse().map((publication) => {
      const row = document.createElement('tr');
      const name = document.createElement('th');
      name.scope = 'row';
      name.textContent = publicationName(publication);
      row.append(name, cell(dateTimeFmt.format(publication.t)));
      if (publication.windowMs === undefined) {
        row.append(cell('–'), cell('–', 'num'), cell('–', 'num'), cell(publication.isUpdate ? '–' : 'Baseline', 'num'));
      } else {
        row.append(
          cell(windowLabel(publication.windowMs)),
          cell(String(publication.before), 'num'),
          cell(String(publication.after), 'num'),
          cell(changeLabel(publication.before, publication.after), 'num'),
        );
      }
      return row;
    });
    if (!rows.length) {
      const row = document.createElement('tr');
      const empty = cell('This article has never been published, so there are no updates to compare yet.');
      empty.colSpan = 6;
      row.append(empty);
      rows.push(row);
    }
    impactBody.replaceChildren(...rows);
  }

  function render() {
    const hourly = data.bucketMs === HOUR_MS;
    $('analytics-total').textContent = data.totalViews;
    $('analytics-period').textContent = data.periodViews;
    $('analytics-period-label').textContent = `Views, ${data.rangeLabel.toLowerCase()}`;
    $('analytics-updates').textContent = data.publications.filter((publication) => publication.isUpdate && publication.inRange).length;
    $('analytics-range-label').textContent = `${data.rangeLabel.toUpperCase()} · ${hourly ? 'YOUR LOCAL TIME' : 'UTC DAYS'}`;
    $('analytics-legend-views').textContent = hourly ? 'Views per hour' : 'Views per day';
    message.textContent = data.periodViews === 0 ? `No recorded views in the ${data.rangeLabel.toLowerCase()}.` : '';
    hoverIndex = -1;
    tooltip.hidden = true;
    draw();
    renderImpact();
  }

  async function load(range) {
    rangeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.range === range)));
    message.textContent = 'Loading…';
    try {
      const response = await fetch(`${root.dataset.api}?range=${encodeURIComponent(range)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const payload = window.sanitize.data(await response.json().catch(() => null));
      if (!response.ok || !payload) throw new Error((payload && payload.message) || 'The analytics could not be loaded.');
      data = payload;
      const url = new URL(window.location.href);
      url.searchParams.set('range', data.range);
      window.history.replaceState(null, '', url);
      render();
    } catch (error) {
      message.textContent = error instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : error.message;
    }
  }

  rangeButtons.forEach((button) => button.addEventListener('click', () => load(button.dataset.range)));
  window.addEventListener('resize', draw);
  load(root.dataset.range);
})();
