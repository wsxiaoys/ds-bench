import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate, type DocumentHead } from '@builder.io/qwik-city';
import { getCurrentUser } from '../../auth';
import { db } from '../../db';

export const useAdminData = routeLoader$((event) => {
  const user = getCurrentUser(event);
  if (!user) {
    throw event.redirect(302, '/login');
  }
  if (user.role !== 'admin') {
    event.status(403);
    return { authorized: false, user: null, users: [] };
  }

  // Load users list (never expose password data)
  const users = db.prepare('SELECT id, username, role FROM users').all() as Array<{ id: number; username: string; role: string }>;
  return { authorized: true, user, users };
});

export default component$(() => {
  const adminData = useAdminData();
  const navigate = useNavigate();

  // Signals for new user form
  const newUsername = useSignal('');
  const newPassword = useSignal('');
  const newRole = useSignal('viewer');
  const error = useSignal('');
  const success = useSignal('');

  if (!adminData.value.authorized) {
    return (
      <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1 style={{ color: '#cf222e' }}>403 Forbidden</h1>
        <p>You do not have permission to view this page.</p>
        <a href="/" style={{ color: '#0066cc', textDecoration: 'none' }}>Go back to home</a>
      </div>
    );
  }

  const handleCreateUser = $(async () => {
    error.value = '';
    success.value = '';

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.value,
          password: newPassword.value,
          role: newRole.value,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        error.value = data.error || 'Failed to create user';
        return;
      }

      success.value = `User "${data.username}" created successfully!`;
      newUsername.value = '';
      newPassword.value = '';
      newRole.value = 'viewer';

      // Reload the page to get the updated users list from the server
      await navigate();
    } catch (err) {
      error.value = 'An error occurred';
    }
  });

  const handleLogout = $(async () => {
    await fetch('/api/logout', { method: 'POST' });
    await navigate('/login');
  });

  const displayUsers = adminData.value.users || [];

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>User Management</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>Logged in as: <strong>{adminData.value.user?.username}</strong> ({adminData.value.user?.role})</p>
        </div>
        <div>
          <a href="/" style={{ marginRight: '15px', textDecoration: 'none', color: '#0066cc', fontWeight: 'bold' }}>View Content</a>
          <button onClick$={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Log Out
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        {/* Left Column: Create User */}
        <div>
          <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Create New User</h2>
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
          <form onSubmit$={(e) => { e.preventDefault(); handleCreateUser(); }}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Username</label>
              <input
                type="text"
                id="create-username"
                value={newUsername.value}
                onInput$={(e) => (newUsername.value = (e.target as HTMLInputElement).value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Password</label>
              <input
                type="password"
                id="create-password"
                value={newPassword.value}
                onInput$={(e) => (newPassword.value = (e.target as HTMLInputElement).value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Role</label>
              <select
                id="create-role"
                value={newRole.value}
                onChange$={(e) => (newRole.value = (e.target as HTMLSelectElement).value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Create User
            </button>
          </form>
        </div>

        {/* Right Column: Users List */}
        <div>
          <h2 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Existing Users</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>ID</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Username</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{u.id}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{u.username}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: u.role === 'admin' ? '#f8d7da' : u.role === 'editor' ? '#fff3cd' : '#d1ecf1',
                      color: u.role === 'admin' ? '#721c24' : u.role === 'editor' ? '#856404' : '#0c5460'
                    }}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Admin - User Management',
};
