import { component$, useStore, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate, type DocumentHead } from '@builder.io/qwik-city';
import { db } from '../lib/db';

export const useDashboardData = routeLoader$(({ sharedMap, redirect }) => {
  const user = sharedMap.get('user');
  if (!user) {
    throw redirect(302, '/login');
  }

  try {
    const content = db.prepare('SELECT id, title, body FROM content ORDER BY id ASC').all() as {
      id: number;
      title: string;
      body: string;
    }[];
    return {
      user,
      content,
    };
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    return {
      user,
      content: [] as { id: number; title: string; body: string }[],
    };
  }
});

export default component$(() => {
  const data = useDashboardData();
  const nav = useNavigate();

  const state = useStore({
    title: '',
    body: '',
    error: '',
    success: '',
    contentList: [...data.value.content],
  });

  const handleAddContent = $(async (e: Event) => {
    e.preventDefault();
    state.error = '';
    state.success = '';

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: state.title,
          body: state.body,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        state.success = 'Content successfully added!';
        state.contentList = [...state.contentList, result];
        state.title = '';
        state.body = '';
      } else {
        state.error = result.error || 'Failed to add content';
      }
    } catch (err) {
      state.error = 'An error occurred while adding content';
    }
  });

  const handleDeleteContent = $(async (id: number) => {
    state.error = '';
    state.success = '';

    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'DELETE',
      });

      const result = await res.json();

      if (res.ok) {
        state.success = 'Content successfully deleted!';
        state.contentList = state.contentList.filter((item) => item.id !== id);
      } else {
        state.error = result.error || 'Failed to delete content';
      }
    } catch (err) {
      state.error = 'An error occurred while deleting content';
    }
  });

  const handleLogout = $(async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      nav('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  });

  const canEdit = data.value.user.role === 'admin' || data.value.user.role === 'editor';
  const isAdmin = data.value.user.role === 'admin';

  return (
    <div style={{
      maxWidth: '900px',
      margin: '40px auto',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #eee',
        paddingBottom: '16px',
        marginBottom: '24px'
      }}>
        <h1 style={{ margin: 0 }}>RBAC Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Logged in as: <strong>{data.value.user.username}</strong> ({data.value.user.role})</span>
          {isAdmin && (
            <button
              onClick$={() => nav('/admin')}
              style={{
                padding: '6px 12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              User Management
            </button>
          )}
          <button
            onClick$={handleLogout}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {state.error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {state.error}
        </div>
      )}

      {state.success && (
        <div style={{
          padding: '12px',
          backgroundColor: '#e8f5e9',
          color: '#2e7d32',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          {state.success}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: canEdit ? '1.5fr 1fr' : '1fr', gap: '32px' }}>
        {/* Content List */}
        <div>
          <h2 style={{ marginBottom: '16px' }}>Dashboard Content</h2>
          {state.contentList.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No content available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {state.contentList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    padding: '16px',
                    position: 'relative',
                    backgroundColor: '#fff'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{item.title}</h3>
                  <p style={{ margin: 0, color: '#444', lineHeight: '1.5' }}>{item.body}</p>
                  
                  {canEdit && (
                    <button
                      onClick$={() => handleDeleteContent(item.id)}
                      style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        padding: '4px 8px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Content Form (only for editor/admin) */}
        {canEdit && (
          <div>
            <h2 style={{ marginBottom: '16px' }}>Create Content</h2>
            <form onSubmit$={handleAddContent} style={{ border: '1px solid #dee2e6', padding: '20px', borderRadius: '6px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Title</label>
                <input
                  type="text"
                  value={state.title}
                  onInput$={(e) => (state.title = (e.target as HTMLInputElement).value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Body</label>
                <textarea
                  value={state.body}
                  onInput$={(e) => (state.body = (e.target as HTMLTextAreaElement).value)}
                  required
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#0056b3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                Create Post
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'RBAC Dashboard',
};
