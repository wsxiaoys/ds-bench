import { component$, useStore, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate } from '@builder.io/qwik-city';
import { db } from '../../lib/db';

export const useAdminData = routeLoader$(({ sharedMap, redirect, status }) => {
  const user = sharedMap.get('user');
  if (!user) {
    throw redirect(302, '/login');
  }
  if (user.role !== 'admin') {
    status(403);
    return {
      error: 'Forbidden',
      status: 403,
      user,
      users: [] as { id: number; username: string; role: string }[],
    };
  }

  try {
    const users = db.prepare('SELECT id, username, role FROM users ORDER BY id ASC').all() as {
      id: number;
      username: string;
      role: string;
    }[];
    return {
      error: null,
      status: 200,
      user,
      users,
    };
  } catch (err) {
    console.error('Error loading users in loader:', err);
    return {
      error: 'Internal Server Error',
      status: 500,
      user,
      users: [] as { id: number; username: string; role: string }[],
    };
  }
});

export default component$(() => {
  const adminData = useAdminData();
  const nav = useNavigate();

  // If there's a 403 error, render a Forbidden page with 403 status
  if (adminData.value.status === 403) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '80px auto',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        <h1 style={{ color: '#c62828', fontSize: '36px', marginBottom: '16px' }}>403 Forbidden</h1>
        <p style={{ fontSize: '18px', color: '#555' }}>You do not have permission to access the admin panel.</p>
        <button
          onClick$={() => nav('/')}
          style={{
            marginTop: '24px',
            padding: '10px 20px',
            backgroundColor: '#0056b3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const formState = useStore({
    username: '',
    password: '',
    role: 'viewer',
    error: '',
    success: '',
    usersList: [...adminData.value.users],
  });

  const handleAddUser = $(async (e: Event) => {
    e.preventDefault();
    formState.error = '';
    formState.success = '';

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formState.username,
          password: formState.password,
          role: formState.role,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        formState.success = `User "${data.username}" successfully created!`;
        formState.usersList = [...formState.usersList, data];
        formState.username = '';
        formState.password = '';
        formState.role = 'viewer';
      } else {
        formState.error = data.error || 'Failed to create user';
      }
    } catch (err) {
      formState.error = 'An error occurred while creating user';
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

  return (
    <div style={{
      maxWidth: '900px',
      margin: '40px auto',
      padding: '24px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #eee',
        paddingBottom: '16px',
        marginBottom: '24px'
      }}>
        <h1 style={{ margin: 0 }}>User Management</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Logged in as: <strong>{adminData.value.user?.username}</strong> ({adminData.value.user?.role})</span>
          <button
            onClick$={() => nav('/')}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Dashboard
          </button>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Users List */}
        <div>
          <h2 style={{ marginBottom: '16px' }}>Existing Users</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>ID</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Username</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {formState.usersList.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{u.id}</td>
                  <td style={{ padding: '12px' }}>{u.username}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: u.role === 'admin' ? '#e3f2fd' : u.role === 'editor' ? '#e8f5e9' : '#f5f5f5',
                      color: u.role === 'admin' ? '#0d47a1' : u.role === 'editor' ? '#1b5e20' : '#616161'
                    }}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add User Form */}
        <div>
          <h2 style={{ marginBottom: '16px' }}>Add New User</h2>
          
          {formState.error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {formState.error}
            </div>
          )}

          {formState.success && (
            <div style={{
              padding: '12px',
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {formState.success}
            </div>
          )}

          <form onSubmit$={handleAddUser} style={{ border: '1px solid #dee2e6', padding: '20px', borderRadius: '6px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Username</label>
              <input
                type="text"
                value={formState.username}
                onInput$={(e) => (formState.username = (e.target as HTMLInputElement).value)}
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

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Password</label>
              <input
                type="password"
                value={formState.password}
                onInput$={(e) => (formState.password = (e.target as HTMLInputElement).value)}
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
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Role</label>
              <select
                value={formState.role}
                onChange$={(e) => (formState.role = (e.target as HTMLSelectElement).value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                  backgroundColor: 'white'
                }}
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Create User
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});
