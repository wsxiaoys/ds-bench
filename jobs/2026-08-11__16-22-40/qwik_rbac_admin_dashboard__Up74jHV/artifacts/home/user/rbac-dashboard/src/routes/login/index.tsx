import { component$, useSignal, $ } from '@builder.io/qwik';
import { useNavigate, type DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  const username = useSignal('');
  const password = useSignal('');
  const error = useSignal('');
  const navigate = useNavigate();

  const handleLogin = $(async () => {
    error.value = '';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.value, password: password.value }),
      });
      const data = await res.json();
      if (!res.ok) {
        error.value = data.error || 'Login failed';
        return;
      }
      if (data.role === 'admin') {
        await navigate('/admin');
      } else {
        await navigate('/');
      }
    } catch (err) {
      error.value = 'An error occurred during login';
    }
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '30px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>RBAC Admin Dashboard</h2>
        {error.value && (
          <div style={{ padding: '10px', backgroundColor: '#ffebe9', border: '1px solid #ffc1c0', borderRadius: '4px', color: '#cf222e', marginBottom: '16px', fontSize: '14px' }}>
            {error.value}
          </div>
        )}
        <form onSubmit$={(e) => { e.preventDefault(); handleLogin(); }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#444' }}>Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={username.value}
              onInput$={(e) => (username.value = (e.target as HTMLInputElement).value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontSize: '14px' }}
              required
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px', color: '#444' }}>Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password.value}
              onInput$={(e) => (password.value = (e.target as HTMLInputElement).value)}
              style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', fontSize: '14px' }}
              required
            />
          </div>
          <button
            type="submit"
            style={{ width: '100%', padding: '12px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Login - RBAC Dashboard',
};
