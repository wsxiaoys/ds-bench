import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate, Link } from '@builder.io/qwik-city';
import { db } from '../lib/db';

export const useDashboardData = routeLoader$((event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    throw event.redirect(302, '/login');
  }

  // Load content
  const contents = db.prepare('SELECT id, title, body FROM content').all() as any[];

  return {
    user,
    contents,
  };
});

export default component$(() => {
  const data = useDashboardData();
  const nav = useNavigate();

  // Local state for content list
  const contentList = useSignal(data.value.contents);

  // Form state
  const title = useSignal('');
  const bodyText = useSignal('');
  const errorMessage = useSignal('');
  const successMessage = useSignal('');

  const handleCreateContent = $(async (e: Event) => {
    e.preventDefault();
    errorMessage.value = '';
    successMessage.value = '';

    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.value,
          body: bodyText.value,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        errorMessage.value = result.error || 'Failed to create content';
        return;
      }

      successMessage.value = 'Content created successfully!';
      contentList.value = [...contentList.value, result];

      // Reset form
      title.value = '';
      bodyText.value = '';
    } catch (err) {
      errorMessage.value = 'An error occurred while creating content';
    }
  });

  const handleDeleteContent = $(async (id: number) => {
    errorMessage.value = '';
    successMessage.value = '';

    try {
      const res = await fetch(`/api/content/${id}`, {
        method: 'DELETE',
      });

      const result = await res.json();
      if (!res.ok) {
        errorMessage.value = result.error || 'Failed to delete content';
        return;
      }

      successMessage.value = 'Content deleted successfully!';
      contentList.value = contentList.value.filter((item) => item.id !== id);
    } catch (err) {
      errorMessage.value = 'An error occurred while deleting content';
    }
  });

  const handleLogout = $(async () => {
    await fetch('/api/logout', { method: 'POST' });
    nav('/login');
  });

  const canEdit = data.value.user.role === 'admin' || data.value.user.role === 'editor';
  const isAdmin = data.value.user.role === 'admin';

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f3f4f6',
      minHeight: '100vh',
      padding: '40px 20px',
      color: '#111827'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '30px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: '20px',
          marginBottom: '30px'
        }}>
          <div>
            <h1 style={{ margin: '0', fontSize: '28px', fontWeight: '700' }}>RBAC Admin Dashboard</h1>
            <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              Logged in as <strong style={{ color: '#111827' }}>{data.value.user.username}</strong> ({data.value.user.role})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {isAdmin && (
              <Link href="/admin" style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '4px',
                textDecoration: 'none',
                fontWeight: '500',
                fontSize: '14px'
              }}>
                User Management
              </Link>
            )}
            <button onClick$={handleLogout} style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              fontWeight: '500',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              Log Out
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: canEdit ? '3fr 2fr' : '1fr',
          gap: '40px'
        }}>
          {/* Left Column: Content List */}
          <div>
            <h2 style={{ fontSize: '20px', margin: '0 0 20px 0', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px' }}>
              Dashboard Content
            </h2>

            {errorMessage.value && !canEdit && (
              <div style={{
                backgroundColor: '#fde8e8',
                color: '#9b1c1c',
                padding: '10px',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '14px'
              }}>
                {errorMessage.value}
              </div>
            )}

            {contentList.value.length === 0 ? (
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No content available.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {contentList.value.map((item) => (
                  <div key={item.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '20px',
                    backgroundColor: '#f9fafb',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '600' }}>{item.title}</h3>
                      {canEdit && (
                        <button
                          onClick$={() => handleDeleteContent(item.id)}
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p style={{ margin: '0', color: '#4b5563', whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.5' }}>
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Create Content (only for editor/admin) */}
          {canEdit && (
            <div>
              <h2 style={{ fontSize: '20px', margin: '0 0 20px 0', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px' }}>
                Create New Content
              </h2>

              {errorMessage.value && (
                <div style={{
                  backgroundColor: '#fde8e8',
                  color: '#9b1c1c',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '15px',
                  fontSize: '14px'
                }}>
                  {errorMessage.value}
                </div>
              )}

              {successMessage.value && (
                <div style={{
                  backgroundColor: '#def7ec',
                  color: '#03543f',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '15px',
                  fontSize: '14px'
                }}>
                  {successMessage.value}
                </div>
              )}

              <form onSubmit$={handleCreateContent} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label htmlFor="content-title" style={{ fontSize: '14px', fontWeight: '500' }}>Title</label>
                  <input
                    id="content-title"
                    type="text"
                    value={title.value}
                    onInput$={(e) => (title.value = (e.target as HTMLInputElement).value)}
                    required
                    style={{
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label htmlFor="content-body" style={{ fontSize: '14px', fontWeight: '500' }}>Body</label>
                  <textarea
                    id="content-body"
                    value={bodyText.value}
                    onInput$={(e) => (bodyText.value = (e.target as HTMLTextAreaElement).value)}
                    required
                    rows={5}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <button type="submit" style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}>
                  Create Content
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
