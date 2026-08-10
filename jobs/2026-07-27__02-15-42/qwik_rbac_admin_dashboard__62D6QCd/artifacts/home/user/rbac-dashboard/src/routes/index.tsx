import { component$, useStore, useSignal, $, useVisibleTask$ } from '@builder.io/qwik';
import { useNavigate, routeLoader$ } from '@builder.io/qwik-city';
import { getDb } from '../db';

export const useDashboardLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    throw event.redirect(302, '/login');
  }

  try {
    const db = await getDb();
    const contents = await db.all<{ id: number; title: string; body: string }[]>(
      'SELECT id, title, body FROM content'
    );
    return { user, contents };
  } catch (err) {
    console.error('Error loading content:', err);
    return { user, contents: [] };
  }
});

export default component$(() => {
  const loader = useDashboardLoader();
  const nav = useNavigate();

  const user = loader.value.user;
  const isEditorOrAdmin = user.role === 'editor' || user.role === 'admin';

  const contentsSignal = useSignal(loader.value.contents || []);
  const form = useStore({ title: '', body: '' });
  const errorMsg = useSignal('');
  const successMsg = useSignal('');
  const loading = useSignal(false);

  // Sync with loader value on load
  useVisibleTask$(({ track }) => {
    track(() => loader.value.contents);
    if (loader.value.contents) {
      contentsSignal.value = loader.value.contents;
    }
  });

  const handleAddContent = $(async (e: Event) => {
    e.preventDefault();
    errorMsg.value = '';
    successMsg.value = '';
    loading.value = true;

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        errorMsg.value = data.error || 'Failed to add content';
      } else {
        successMsg.value = 'Content published successfully!';
        contentsSignal.value = [...contentsSignal.value, data];
        form.title = '';
        form.body = '';
      }
    } catch (err) {
      errorMsg.value = 'An unexpected error occurred';
    } finally {
      loading.value = false;
    }
  });

  const handleDeleteContent = $(async (id: number) => {
    if (!confirm('Are you sure you want to delete this content?')) {
      return;
    }

    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete content');
      } else {
        contentsSignal.value = contentsSignal.value.filter((c) => c.id !== id);
      }
    } catch (err) {
      alert('An unexpected error occurred');
    }
  });

  const handleLogout = $(async () => {
    await fetch('/api/logout', { method: 'POST' });
    nav('/login');
  });

  return (
    <div class="dashboard">
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
        .content-item {
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          position: relative;
          background-color: #f9fafb;
        }
        .content-item h3 {
          margin-top: 0;
          margin-bottom: 0.5rem;
          color: #111827;
          font-size: 1.125rem;
        }
        .content-item p {
          margin: 0;
          color: #4b5563;
          line-height: 1.5;
        }
        .delete-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background-color: #fee2e2;
          color: #b91c1c;
          border: none;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
        }
        .delete-btn:hover {
          background-color: #fca5a5;
        }
        
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
        input, textarea {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 0.875rem;
          box-sizing: border-box;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #2563eb;
        }
        textarea {
          resize: vertical;
          min-height: 100px;
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
        .no-content {
          text-align: center;
          color: #6b7280;
          padding: 3rem 1rem;
        }
      `}</style>

      <header>
        <div style="display: flex; align-items: center; gap: 2rem;">
          <h1>RBAC Dashboard</h1>
          <nav>
            <a href="/" class="active">Dashboard</a>
            {user.role === 'admin' && <a href="/admin">User Management</a>}
          </nav>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span style="font-size: 0.875rem; color: #4b5563;">
            Logged in as: <strong>{user.username}</strong> ({user.role})
          </span>
          <button class="logout-btn" onClick$={handleLogout}>Logout</button>
        </div>
      </header>

      <main class="container" style={!isEditorOrAdmin ? "grid-template-columns: 1fr;" : ""}>
        <div class="section-card">
          <h2>Dashboard Content</h2>
          {contentsSignal.value.length === 0 ? (
            <div class="no-content">No content items available.</div>
          ) : (
            <div>
              {contentsSignal.value.map((c) => (
                <div class="content-item" key={c.id}>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                  {isEditorOrAdmin && (
                    <button class="delete-btn" onClick$={() => handleDeleteContent(c.id)}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isEditorOrAdmin && (
          <div class="section-card">
            <h2>Publish New Content</h2>
            {errorMsg.value && <div class="alert alert-error">{errorMsg.value}</div>}
            {successMsg.value && <div class="alert alert-success">{successMsg.value}</div>}
            <form onSubmit$={handleAddContent}>
              <div class="form-group">
                <label for="title">Title</label>
                <input
                  type="text"
                  id="title"
                  value={form.title}
                  onInput$={(e, target) => (form.title = target.value)}
                  required
                  placeholder="Enter title"
                />
              </div>
              <div class="form-group">
                <label for="body">Body</label>
                <textarea
                  id="body"
                  value={form.body}
                  onInput$={(e, target) => (form.body = target.value)}
                  required
                  placeholder="Enter body text"
                />
              </div>
              <button type="submit" class="submit-btn" disabled={loading.value}>
                {loading.value ? 'Publishing...' : 'Publish Content'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
});
