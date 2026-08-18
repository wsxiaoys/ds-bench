import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate, type DocumentHead } from '@builder.io/qwik-city';
import { getCurrentUser } from '../auth';
import { db } from '../db';

export const useHomeData = routeLoader$((event) => {
  const user = getCurrentUser(event);
  if (!user) {
    throw event.redirect(302, '/login');
  }

  // Load content
  const content = db.prepare('SELECT id, title, body FROM content').all() as Array<{ id: number; title: string; body: string }>;
  return { user, content };
});

export default component$(() => {
  const data = useHomeData();
  const navigate = useNavigate();

  // Signals for new content form
  const newTitle = useSignal('');
  const newBody = useSignal('');
  const error = useSignal('');
  const success = useSignal('');

  const handleCreateContent = $(async () => {
    error.value = '';
    success.value = '';

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.value,
          body: newBody.value,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        error.value = resData.error || 'Failed to create content';
        return;
      }

      success.value = `Content "${resData.title}" created successfully!`;
      newTitle.value = '';
      newBody.value = '';

      // Reload the page to get the updated content list
      await navigate();
    } catch (err) {
      error.value = 'An error occurred';
    }
  });

  const handleDeleteContent = $(async (id: number) => {
    error.value = '';
    success.value = '';

    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'DELETE',
      });

      const resData = await res.json();
      if (!res.ok) {
        error.value = resData.error || 'Failed to delete content';
        return;
      }

      success.value = 'Content deleted successfully!';
      await navigate();
    } catch (err) {
      error.value = 'An error occurred';
    }
  });

  const handleLogout = $(async () => {
    await fetch('/api/logout', { method: 'POST' });
    await navigate('/login');
  });

  const user = data.value.user;
  const contentList = data.value.content || [];
  const canModify = user.role === 'admin' || user.role === 'editor';

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>RBAC Dashboard</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>Logged in as: <strong>{user.username}</strong> ({user.role})</p>
        </div>
        <div>
          {user.role === 'admin' && (
            <a href="/admin" style={{ marginRight: '15px', textDecoration: 'none', color: '#28a745', fontWeight: 'bold' }}>User Management</a>
          )}
          <button onClick$={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Log Out
          </button>
        </div>
      </div>

      {error.value && (
        <div style={{ padding: '10px', backgroundColor: '#ffebe9', border: '1px solid #ffc1c0', borderRadius: '4px', color: '#cf222e', marginBottom: '16px' }}>
          {error.value}
        </div>
      )}
      {success.value && (
        <div style={{ padding: '10px', backgroundColor: '#dafbe1', border: '1px solid #bbeec6', borderRadius: '4px', color: '#1a7f37', marginBottom: '16px' }}>
          {success.value}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: canModify ? '2fr 1fr' : '1fr', gap: '40px' }}>
        {/* Left Column: Content list */}
        <div>
          <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Dashboard Content</h2>
          {contentList.length === 0 ? (
            <p style={{ color: '#666' }}>No content available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {contentList.map((item) => (
                <div key={item.id} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '6px', backgroundColor: '#fafafa', position: 'relative' }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{item.title}</h3>
                  <p style={{ margin: 0, color: '#333', lineHeight: '1.5' }}>{item.body}</p>
                  {canModify && (
                    <button
                      onClick$={() => handleDeleteContent(item.id)}
                      style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        padding: '6px 12px',
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

        {/* Right Column: Create Content (only for editor/admin) */}
        {canModify && (
          <div>
            <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Create Content</h2>
            <form onSubmit$={(e) => { e.preventDefault(); handleCreateContent(); }}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Title</label>
                <input
                  type="text"
                  id="create-title"
                  value={newTitle.value}
                  onInput$={(e) => (newTitle.value = (e.target as HTMLInputElement).value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Body</label>
                <textarea
                  id="create-body"
                  value={newBody.value}
                  onInput$={(e) => (newBody.value = (e.target as HTMLTextAreaElement).value)}
                  style={{ width: '100%', height: '120px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
                  required
                />
              </div>
              <button
                type="submit"
                style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Publish Content
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Home - RBAC Dashboard',
};
