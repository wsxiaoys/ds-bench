import { component$, useStore, useSignal, $, useVisibleTask$ } from '@builder.io/qwik';
import { useNavigate, routeLoader$ } from '@builder.io/qwik-city';
import { getDb } from '../../db';

export const useAdminLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    throw event.redirect(302, '/login');
  }

  if (user.role !== 'admin') {
    event.status(403);
    return { forbidden: true, user, users: [] };
  }

  try {
    const db = await getDb();
    const users = await db.all<{ id: number; username: string; role: string }[]>(
      'SELECT id, username, role FROM users'
    );
    return { forbidden: false, user, users };
  } catch (err) {
    console.error('Error loading users:', err);
    return { forbidden: false, user, users: [] };
  }
});

export default component$(() => {
  const loader = useAdminLoader();
  const nav = useNavigate();

  if (loader.value.forbidden) {
    return (
      <div class="forbidden-container">
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
          .card {
            background: white;
            padding: 2.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #dc2626;
            margin-top: 0;
          }
          p {
            color: #4b5563;
            margin-bottom: 1.5rem;
          }
          .btn {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
          }
        `}</style>
        <div class="card">
          <h1>403 - Forbidden</h1>
          <p>You do not have administrative privileges to access this area.</p>
          <a href="/" class="btn">Back to Dashboard</a>
        </div>
      </div>
    );
  }

  const usersSignal = useSignal(loader.value.users || []);
  const form = useStore({ username: '', password: '', role: 'viewer' });
  const errorMsg = useSignal('');
  const successMsg = useSignal('');
  const loading = useSignal(false);

  // Sync with loader value on load
  useVisibleTask$(({ track }) => {
    track(() => loader.value.users);
    if (loader.value.users) {
      usersSignal.value = loader.value.users;
    }
  });

  const handleAddUser = $(async (e: Event) => {
    e.preventDefault();
    errorMsg.value = '';
    successMsg.value = '';
    loading.value = true;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          role: form.role,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        errorMsg.value = data.error || 'Failed to add user';
      } else {
        successMsg.value = `User "${data.username}" created successfully!`;
        usersSignal.value = [...usersSignal.value, data];
        form.username = '';
        form.password = '';
        form.role = 'viewer';
      }
    } catch (err) {
      errorMsg.value = 'An unexpected error occurred';
    } finally {
      loading.value = false;
    }
  });

  const handleLogout = $(async () => {
    await fetch('/api/logout', { method: 'POST' });
    nav('/login');
  });

  return (
    <div class="admin-dashboard">
      <style>{`
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #f3f4f6;
          color: #1f2937;
        }
        header {
          background-color: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        header h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: #111827;
        }
        nav a {
          color: #4b5563;
          text-decoration: none;
          margin-right: 1.5rem;
          font-weight: 500;
        }
        nav a:hover, nav a.active {
          color: #2563eb;
        }
        .logout-btn {
          background: none;
          border: 1px solid #d1d5db;
          color: #4b5563;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        .logout-btn:hover {
          background-color: #f9fafb;
          color: #111827;
        }
        .container {
          max-width: 1200px;
          margin: 2rem auto;
          padding: 0 1rem;
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 2rem;
        }
        @media (max-width: 768px) {
          .container {
            grid-template-columns: 1fr;
          }
        }
        .section-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .section-card h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          font-size: 1.25rem;
          color: #111827;
          border-bottom: 1px solid #f3f4f6;
          padding-bottom: 0.75rem;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        th, td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e7eb;
        }
        th {
          background-color: #f9fafb;
          color: #374151;
          font-weight: 600;
        }
        .badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge-admin { background-color: #fee2e2; color: #991b1b; }
        .badge-editor { background-color: #fef3c7; color: #92400e; }
        .badge-viewer { background-color: #e0f2fe; color: #075985; }
        
        .form-group {
          margin-bottom: 1rem;
        }
        label {
          display: block;
          margin-bottom: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
        }
        input, select {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.875rem;
          box-sizing: border-box;
        }
        input:focus, select:focus {
          outline: none;
          border-color: #2563eb;
        }
        .submit-btn {
          width: 100%;
          padding: 0.625rem;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
        }
        .submit-btn:hover {
          background-color: #1d4ed8;
        }
        .submit-btn:disabled {
          background-color: #93c5fd;
        }
        .alert {
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        .alert-error {
          background-color: #fee2e2;
          border: 1px solid #fca5a5;
          color: #b91c1c;
        }
        .alert-success {
          background-color: #d1fae5;
          border: 1px solid #6ee7b7;
          color: #065f46;
        }
      `}</style>

      <header>
        <div style="display: flex; align-items: center; gap: 2rem;">
          <h1>RBAC Dashboard</h1>
          <nav>
            <a href="/">Dashboard</a>
            <a href="/admin" class="active">User Management</a>
          </nav>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span style="font-size: 0.875rem; color: #4b5563;">
            Logged in as: <strong>{loader.value.user?.username}</strong> ({loader.value.user?.role})
          </span>
          <button class="logout-btn" onClick$={handleLogout}>Logout</button>
        </div>
      </header>

      <main class="container">
        <div class="section-card">
          <h2>User Directory</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {usersSignal.value.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>
                    <span class={`badge badge-${u.role}`}>{u.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="section-card">
          <h2>Add New User</h2>
          {errorMsg.value && <div class="alert alert-error">{errorMsg.value}</div>}
          {successMsg.value && <div class="alert alert-success">{successMsg.value}</div>}
          <form onSubmit$={handleAddUser}>
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
            <div class="form-group">
              <label for="role">Role</label>
              <select
                id="role"
                value={form.role}
                onChange$={(e, target) => (form.role = target.value)}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" class="submit-btn" disabled={loading.value}>
              {loading.value ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
});
