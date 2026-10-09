// Shared DOMPurify helpers. Every script that renders a GET response passes the
// response through here before any of it reaches the DOM.
window.sanitize = (() => {
  'use strict';

  const purify = window.DOMPurify;
  const TEXT_ONLY = { ALLOWED_TAGS: [], ALLOWED_ATTR: [], RETURN_DOM: true };

  // Plain text with every tag and attribute removed.
  function text(value) {
    const raw = String(value ?? '');
    if (!purify) return raw; // callers only ever assign this with textContent
    return purify.sanitize(raw, TEXT_ONLY).textContent;
  }

  // Markup that is safe to assign with innerHTML.
  function html(markup) {
    const raw = String(markup ?? '');
    if (purify) return purify.sanitize(raw, { USE_PROFILES: { html: true } });
    return raw.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  }

  // A copy of a JSON payload with every string value cleaned by text().
  function data(payload) {
    if (typeof payload === 'string') return text(payload);
    if (Array.isArray(payload)) return payload.map(data);
    if (payload && typeof payload === 'object') {
      return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, data(value)]));
    }
    return payload;
  }

  return { text, html, data };
})();
