import { component$, useStore, useSignal, $ } from '@builder.io/qwik';
import { useNavigate, routeLoader$ } from '@builder.io/qwik-city';

// Redirect to dashboard if already logged in
export const useLoginLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get('user');
  if (user) {
    throw event.redirect(302, '/');
  }
  return null;
});

export default component$(() => {
  const nav = useNavigate();
  const form = useStore({ username: '', password: '' });
  const errorMsg = useSignal('');
  const loading = useSignal(false);

  const handleSubmit = $(async (e: Event) => {
    e.preventDefault();
    errorMsg.value = '';
    loading.value = true;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });

      const data = await res.json();
      if (!res.ok) {
        errorMsg.value = data.error || 'Login failed';
      } else {
        // Redirect to dashboard
        nav('/');
      }
    } catch (err) {
      errorMsg.value = 'An unexpected error occurred';
    } finally {
      loading.value = false;
    }
  });

  return (
    <div class="login-container">
      <style>{`
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .login-card {
          background: white;
          padding: 2.5rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          width: 100%;
          max-width: 400px;
          box-sizing: border-box;
        }
        h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          color: #111827;
          font-size: 1.75rem;
          font-weight: 700;
          text-align: center;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          color: #374151;
          font-weight: 500;
          font-size: 0.875rem;
        }
        input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 1rem;
          box-sizing: border-box;
          transition: border-color 0.15s ease-in-out;
        }
        input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        button {
          width: 100%;
          padding: 0.75rem;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
        }
        button:hover {
          background-color: #1d4ed8;
        }
        button:disabled {
          background-color: #93c5fd;
          cursor: not-allowed;
        }
        .error {
          background-color: #fee2e2;
          border: 1px solid #fca5a5;
          color: #b91c1c;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1.25rem;
          font-size: 0.875rem;
        }
      `}</style>
      <div class="login-card">
        <h2>RBAC Admin Portal</h2>
        {errorMsg.value && <div class="error">{errorMsg.value}</div>}
        <form onSubmit$={handleSubmit}>
          <div class="form-group">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              value={form.username}
              onInput$={(e, target) => (form.username = target.value)}
              required
              placeholder="Enter username"
            />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              value={form.password}
              onInput$={(e, target) => (form.password = target.value)}
              required
              placeholder="Enter password"
            />
          </div>
          <button type="submit" disabled={loading.value}>
            {loading.value ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
});
