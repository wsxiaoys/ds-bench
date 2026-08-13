import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate, Link } from '@builder.io/qwik-city';
import { db } from '../../lib/db';

export const useAdminData = routeLoader$((event) => {
  const user = event.sharedMap.get('user');
  if (!user) {
    throw event.redirect(302, '/login');
  }
  if (user.role !== 'admin') {
    event.status(403);
    return { error: 'Forbidden', status: 403, users: [], currentUser: user };
  }
  const users = db.prepare('SELECT id, username, role FROM users').all() as any[];
  return { status: 200, users, currentUser: user };
});

export default component$(() => {
  const data = useAdminData();
  const nav = useNavigate();

  // Form states
  const username = useSignal('');
  const password = useSignal('');
  const role = useSignal('viewer');
  const errorMessage = useSignal('');
  const successMessage = useSignal('');

  // Local list of users to display (initialized from loader data)
  const usersList = useSignal(data.value.users);

  if (data.value.status === 403) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#f3f4f6',
        color: '#111827',
        padding: '20px'
      }}>
        <h1 style={{ fontSize: '48px', margin: '0 0 10px 0', color: '#dc2626' }}>403</h1>
        <p style={{ fontSize: '18px', margin: '0 0 20px 0' }}>Forbidden - Admin access required</p>
        <Link href="/" style={{
          color: '#2563eb',
          textDecoration: 'underline',
          fontSize: '16px'
        }}>
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const handleCreateUser = $(async (e: Event) => {
    e.preventDefault();
    errorMessage.value = '';
    successMessage.value = '';

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.value,
          password: password.value,
          role: role.value,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        errorMessage.value = result.error || 'Failed to create user';
        return;
      }

      successMessage.value = 'User created successfully!';
      // Append to local list
      usersList.value = [...usersList.value, result];

      // Reset form
      username.value = '';
      password.value = '';
      role.value = 'viewer';
    } catch (err) {
      errorMessage.value = 'An error occurred while creating user';
    }
  });

  const handleLogout = $(async () => {
    await fetch('/api/logout', { method: 'POST' });
    nav('/login');
  });

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
            <h1 style={{ margin: '0', fontSize: '28px', fontWeight: '700' }}>User Management</h1>
            <p style={{ margin: '5px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              Logged in as <strong style={{ color: '#111827' }}>{data.value.currentUser?.username}</strong> ({data.value.currentUser?.role})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/" style={{
              backgroundColor: '#e5e7eb',
              color: '#374151',
              padding: '8px 16px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '14px'
            }}>
              Dashboard
            </Link>
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
          gridTemplateColumns: '1fr 1fr',
          gap: '40px'
        }}>
          {/* Left Column: Users List */}
          <div>
            <h2 style={{ fontSize: '20px', margin: '0 0 20px 0', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px' }}>
              Existing Users
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
                textAlign: 'left'
              }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>
                    <th style={{ padding: '10px 5px' }}>ID</th>
                    <th style={{ padding: '10px 5px' }}>Username</th>
                    <th style={{ padding: '10px 5px' }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.value.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 5px', color: '#6b7280' }}>{u.id}</td>
                      <td style={{ padding: '12px 5px', fontWeight: '500' }}>{u.username}</td>
                      <td style={{ padding: '12px 5px' }}>
                        <span style={{
                          backgroundColor: u.role === 'admin' ? '#fee2e2' : u.role === 'editor' ? '#fef3c7' : '#e0f2fe',
                          color: u.role === 'admin' ? '#991b1b' : u.role === 'editor' ? '#92400e' : '#0369a1',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '600'
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

          {/* Right Column: Create User Form */}
          <div>
            <h2 style={{ fontSize: '20px', margin: '0 0 20px 0', borderBottom: '2px solid #f3f4f6', paddingBottom: '10px' }}>
              Create New User
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

            <form onSubmit$={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label htmlFor="reg-username" style={{ fontSize: '14px', fontWeight: '500' }}>Username</label>
                <input
                  id="reg-username"
                  type="text"
                  value={username.value}
                  onInput$={(e) => (username.value = (e.target as HTMLInputElement).value)}
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
                <label htmlFor="reg-password" style={{ fontSize: '14px', fontWeight: '500' }}>Password</label>
                <input
                  id="reg-password"
                  type="password"
                  value={password.value}
                  onInput$={(e) => (password.value = (e.target as HTMLInputElement).value)}
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
                <label htmlFor="reg-role" style={{ fontSize: '14px', fontWeight: '500' }}>Role</label>
                <select
                  id="reg-role"
                  value={role.value}
                  onChange$={(e) => (role.value = (e.target as HTMLSelectElement).value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
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
                Create User
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});
