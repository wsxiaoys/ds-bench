import { CapacitorCookies } from '@capacitor/core';

// --- DOM references -------------------------------------------------------
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const statusEl = document.getElementById('status');
const profileEl = document.getElementById('profile');
const cookieEl = document.getElementById('cookie');
const errorEl = document.getElementById('error');

// --- Helpers --------------------------------------------------------------
function setStatus(username) {
  statusEl.textContent = username ? `Logged in as ${username}` : 'Logged out';
}

function setProfile(username) {
  profileEl.textContent = username ? JSON.stringify({ username }, null, 2) : '';
}

function setCookieDisplay(token) {
  cookieEl.textContent = token || '';
}

function setError(message) {
  errorEl.textContent = message || '';
}

async function readSessionCookie() {
  // CapacitorCookies mirrors document.cookie on the web. Reading through
  // the plugin keeps a single, consistent API path that also works on the
  // native side once the app is wrapped in Capacitor.
  try {
    const cookies = await CapacitorCookies.getCookies();
    return cookies && cookies.session ? cookies.session : '';
  } catch {
    return '';
  }
}

async function clearSessionCookie() {
  // The /api/logout endpoint invalidates the token server-side but does not
  // send a cookie-clearing header, so we are responsible for dropping the
  // cookie in the browser. deleteCookie() expires it by setting Max-Age=0,
  // which makes it disappear from document.cookie on the next read.
  try {
    await CapacitorCookies.deleteCookie({ key: 'session' });
  } catch {
    // Fallback: clear every cookie to be safe.
    try {
      await CapacitorCookies.clearCookies();
    } catch {
      /* ignore */
    }
  }
}

// --- API calls ------------------------------------------------------------
async function apiLogin(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

async function apiMe() {
  const res = await fetch('/api/me', { method: 'GET' });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

async function apiLogout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

// --- UI actions -----------------------------------------------------------
async function renderSignedIn(username) {
  setStatus(username);
  setProfile(username);
  const token = await readSessionCookie();
  setCookieDisplay(token);
  setError('');
}

function renderSignedOut() {
  setStatus('');
  setProfile('');
  setCookieDisplay('');
}

async function handleLogin() {
  setError('');
  const username = (usernameInput.value || '').trim();
  const password = passwordInput.value || '';
  if (!username || !password) {
    setError('invalid credentials');
    return;
  }
  try {
    const { ok, body } = await apiLogin(username, password);
    if (ok && body && body.username) {
      await renderSignedIn(body.username);
      passwordInput.value = '';
    } else {
      const message = (body && body.error) || 'invalid credentials';
      setError(message);
      // Make sure no stray cookie sticks around from a previous session.
      renderSignedOut();
    }
  } catch (err) {
    setError('invalid credentials');
  }
}

async function handleLogout() {
  try {
    await apiLogout();
  } catch {
    /* even if the server call fails we still clear the local cookie */
  }
  await clearSessionCookie();
  renderSignedOut();
}

// --- Bootstrap ------------------------------------------------------------
async function restoreSession() {
  // On every load (including reloads) ask the server who we are. The server
  // reads the session cookie and tells us if it is still valid.
  try {
    const { ok, body } = await apiMe();
    if (ok && body && body.username) {
      await renderSignedIn(body.username);
      return;
    }
  } catch {
    /* fall through to signed-out state */
  }
  renderSignedOut();
}

loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);

restoreSession();
