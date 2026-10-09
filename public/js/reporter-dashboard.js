const logoutButton = document.getElementById('logout');

logoutButton?.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error('Logout failed. Please try again.');
    window.location.assign('/');
  } catch (error) {
    logoutButton.disabled = false;
    logoutButton.textContent = error.message;
  }
});