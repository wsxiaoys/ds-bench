import { component$, useSignal, $ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';

export default component$(() => {
  const username = useSignal('');
  const password = useSignal('');
  const errorMessage = useSignal('');
  const nav = useNavigate();

  const handleLogin = $(async (e: Event) => {
    e.preventDefault();
    errorMessage.value = '';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.value,
          password: password.value,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        errorMessage.value = data.error || 'Login failed';
        return;
      }

      if (data.role === 'admin') {
        nav('/admin');
      } else {
        nav('/');
      }
    } catch (err) {
      errorMessage.value = 'An error occurred during login';
    }
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f3f4f6',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ margin: '0 0 20px 0', fontSize: '24px', textAlign: 'center', color: '#111827' }}>
          RBAC Dashboard Login
        </h1>

        {errorMessage.value && (
          <div style={{
            backgroundColor: '#fde8e8',
            color: '#9b1c1c',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px',
            fontSize: '14px',
            border: '1px solid #f8b4b4'
          }}>
            {errorMessage.value}
          </div>
        )}

        <form onSubmit$={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label htmlFor="username" style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username.value}
              onInput$={(e) => (username.value = (e.target as HTMLInputElement).value)}
              required
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label htmlFor="password" style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password.value}
              onInput$={(e) => (password.value = (e.target as HTMLInputElement).value)}
              required
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              padding: '10px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '10px',
              transition: 'background-color 0.2s'
            }}
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
});
