import { CapacitorCookies } from '@capacitor/core';

// ---- DOM references -------------------------------------------------------
const statusEl = document.getElementById('status') as HTMLElement;
const profileEl = document.getElementById('profile') as HTMLElement;
const cookieEl = document.getElementById('cookie') as HTMLElement;
const errorEl = document.getElementById('error') as HTMLElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;

// ---- Cookie helpers -------------------------------------------------------
// Read the `session` cookie straight from document.cookie as a fallback.
function getSessionTokenFromDocument(): string {
  const match = document.cookie.match(/(?:^|; )session=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// Read the `session` cookie via Capacitor's cookie API (bundled in
// @capacitor/core). On the web this reads document.cookie under the hood, but
// going through the plugin keeps the flow aligned with how it behaves natively.
async function getSessionToken(): Promise<string> {
  try {
    const cookies = await CapacitorCookies.getCookies();
    return cookies.session ?? '';
  } catch {
    return getSessionTokenFromDocument();
  }
}

// ---- Rendering ------------------------------------------------------------
function renderLoggedOut(): void {
  statusEl.textContent = 'Logged out';
  profileEl.textContent = '';
  cookieEl.textContent = '';
}

async function renderLoggedIn(username: string): Promise<void> {
  statusEl.textContent = `Logged in as ${username}`;
  profileEl.textContent = username;
  const token = await getSessionToken();
  cookieEl.textContent = token || getSessionTokenFromDocument();
}

function showError(message: string): void {
  errorEl.textContent = message;
}

function clearError(): void {
  errorEl.textContent = '';
}

// ---- API calls ------------------------------------------------------------
async function fetchMe(): Promise<Response> {
  return fetch('/api/me', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
}

async function postLogin(username: string, password: string): Promise<Response> {
  return fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ username, password }),
  });
}

async function postLogout(): Promise<void> {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    // Even if the server call fails we still clear the local cookie.
  }
}

// ---- Session flows --------------------------------------------------------
// On (re)load, restore the signed-in state from any existing session cookie.
async function restoreSession(): Promise<void> {
  try {
    const res = await fetchMe();
    if (res.ok) {
      const data = await res.json();
      await renderLoggedIn(data.username);
    } else {
      renderLoggedOut();
    }
  } catch {
    renderLoggedOut();
  }
}

async function login(): Promise<void> {
  clearError();
  const username = usernameInput.value;
  const password = passwordInput.value;

  let res: Response;
  try {
    res = await postLogin(username, password);
  } catch {
    showError('invalid credentials');
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    // The server set the session cookie via the Set-Cookie header; the browser
    // now stores it. Reflect the signed-in state.
    await renderLoggedIn(data.username ?? username);
  } else {
    // Invalid credentials: show the server error and do NOT create a session.
    showError(data.error || 'invalid credentials');
  }
}

async function logout(): Promise<void> {
  clearError();
  // 1. Invalidate the token server-side.
  await postLogout();
  // 2. Clear the session cookie on the client. The server does NOT send a
  //    cookie-clearing header, so we are responsible for removing it. Use
  //    Capacitor's cookie API, with a direct document.cookie expiry as a
  //    belt-and-suspenders fallback.
  try {
    await CapacitorCookies.clearAllCookies();
  } catch {
    // ignore and fall through to the manual clear below
  }
  document.cookie = 'session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'session=; Max-Age=0; path=/';
  // 3. Update the UI to the logged-out state.
  renderLoggedOut();
}

// ---- Wire up --------------------------------------------------------------
loginBtn.addEventListener('click', () => {
  void login();
});
logoutBtn.addEventListener('click', () => {
  void logout();
});

// Allow pressing Enter from the password field to submit.
passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    void login();
  }
});

// Restore the session as soon as the page loads.
void restoreSession();