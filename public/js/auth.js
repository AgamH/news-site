(() => {
  'use strict';
  const config = window.AUTH_CONFIG;
  if (!config) return;
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const form = loginForm || registerForm;
  if (!form) return;
  const message = document.getElementById('form-message');
  const submit = document.getElementById('submit');
  const originalLabel = submit.textContent;
  const role = registerForm ? registerForm.dataset.role : null;
  const toggle = document.getElementById('toggle-password');
  if (toggle) toggle.addEventListener('click', () => {
    const password = document.getElementById('password');
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    message.textContent = '';
    submit.disabled = true;
    submit.textContent = loginForm ? 'Logging in…' : 'Creating account…';
    const data = Object.fromEntries(new FormData(form).entries());
    if (role) data.role = role;
    try {
      const response = await fetch(loginForm ? config.loginApi : config.registerApi, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || (response.status === 401 ? 'Incorrect email or password.' : 'Could not complete the request. Please try again.'));
      const userRole = payload?.user?.role || role;
      window.location.replace(config.roleHome[userRole] || '/');
    } catch (error) {
      message.textContent = error instanceof TypeError ? 'Could not reach the server. Check your connection and try again.' : error.message;
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  });
})();