import { CapacitorCookies } from '@capacitor/core';

const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLElement;
const profileEl = document.getElementById('profile') as HTMLElement;
const cookieEl = document.getElementById('cookie') as HTMLElement;
const errorEl = document.getElementById('error') as HTMLElement;

// Helper to update the UI based on logged in state
async function updateUI(loggedIn: boolean, username: string = '') {
  if (loggedIn) {
    statusEl.textContent = `Logged in as ${username}`;
    profileEl.textContent = username;
    const cookies = await CapacitorCookies.getCookies();
    cookieEl.textContent = cookies['session'] || '';
    errorEl.textContent = '';
  } else {
    statusEl.textContent = 'Logged out';
    profileEl.textContent = '';
    cookieEl.textContent = '';
  }
}

// Function to check and restore session on page load
async function checkSession() {
  errorEl.textContent = '';
  try {
    const res = await fetch('/api/me');
    if (res.status === 200) {
      const data = await res.json();
      await updateUI(true, data.username);
    } else {
      await updateUI(false);
    }
  } catch (err) {
    await updateUI(false);
  }
}

// Login handler
async function login() {
  errorEl.textContent = '';
  const username = usernameInput.value;
  const password = passwordInput.value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (res.status === 200) {
      const data = await res.json();
      await updateUI(true, data.username);
      // Clear inputs on success
      usernameInput.value = '';
      passwordInput.value = '';
    } else {
      const data = await res.json();
      errorEl.textContent = data.error || 'invalid credentials';
      await updateUI(false);
    }
  } catch (err: any) {
    errorEl.textContent = 'invalid connection or server error';
    await updateUI(false);
  }
}

// Logout handler
async function logout() {
  try {
    // 1. Invalidate session on the server
    await fetch('/api/logout', { method: 'POST' });
  } catch (err) {
    console.error('Server logout failed', err);
  } finally {
    // 2. Clear the session cookie on the client using Capacitor's API
    await CapacitorCookies.deleteCookie({ key: 'session' });
    // Also clean it up manually to ensure it's gone from browser cookies under all conditions
    document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax';
    
    // 3. Update the UI
    await updateUI(false);
    errorEl.textContent = '';
  }
}

// Event Listeners
loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);

// Initialize session check on load
checkSession();
