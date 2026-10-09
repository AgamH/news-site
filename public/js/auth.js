/**
 * The Web Daily - log in. Vanilla JS, no dependencies.
 *
 *   POST /api/auth/login   body: { email, password }
 *     200 -> { user: { name, role: 'reporter' | 'editor' }, redirectTo?: '/some/path' }
 *     400 / 401 / 429 / 5xx -> { message: 'text that is safe to show the user' }
 *
 * The server sets the session cookie (httpOnly). This script stores nothing in the browser:
 * who the user is and what they may do is always decided by the server.
 */
(() => {
  'use strict';

  const config = window.AUTH_CONFIG;
  if (!config) return;

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const toggleButton = document.getElementById('toggle-password');
  const submitButton = document.getElementById('submit');
  const message = document.getElementById('form-message');

  const SUBMIT_LABEL = submitButton.textContent;
  let submitting = false;

  /** Only same-site paths are accepted as a redirect target ("/x", not "//evil.com" or "https://..."). */
  const isLocalPath = (value) => typeof value === 'string' && /^\/(?![/\\])/.test(value);

  function showMessage(text) {
    message.textContent = text;
  }

  function setBusy(busy) {
    submitting = busy;
    submitButton.disabled = busy;
    submitButton.textContent = busy ? 'Logging in' : SUBMIT_LABEL;
  }

  function messageFor(status, serverMessage) {
    if (serverMessage) return serverMessage;
    if (status === 400) return 'Enter your email and password.';
    if (status === 401) return 'Incorrect email or password.';
    if (status === 429) return 'Too many attempts. Wait a minute and try again.';
    return 'The server had a problem. Try again in a moment.';
  }

  toggleButton.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    toggleButton.textContent = show ? 'Hide' : 'Show';
    toggleButton.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value; // never trimmed: spaces can be part of a password

    if (!email) {
      showMessage('Enter your email.');
      emailInput.focus();
      return;
    }
    if (!password) {
      showMessage('Enter your password.');
      passwordInput.focus();
      return;
    }

    showMessage('');
    setBusy(true);

    try {
      const response = await fetch(config.loginApi, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const error = new Error(messageFor(response.status, body && body.message));
        error.status = response.status;
        throw error;
      }

      // The server decides where this user goes; the role map is only a fallback.
      const role = body && body.user && body.user.role;
      const target = isLocalPath(body && body.redirectTo) ? body.redirectTo : config.roleHome[role] || '/';

      // replace(): the Back button should not return to the login form.
      window.location.replace(target);
    } catch (error) {
      setBusy(false);
      showMessage(
        error instanceof TypeError
          ? 'Could not reach the server. Check your connection and try again.'
          : error.message || 'Something went wrong. Try again.'
      );
      if (error.status === 401) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    }
  });

  // Coming back to this page from the browser cache: make sure the form is usable again.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) setBusy(false);
  });
})();
