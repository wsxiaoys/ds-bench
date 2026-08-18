import { component$, useStore, $ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';

export default component$(() => {
  const state = useStore({
    username: '',
    password: '',
    error: '',
    loading: false,
  });

  const nav = useNavigate();

  const handleSubmit = $(async (e: Event) => {
    e.preventDefault();
    state.error = '';
    state.loading = true;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: state.username,
          password: state.password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.role === 'admin') {
          nav('/admin');
        } else {
          nav('/');
        }
      } else {
        state.error = data.error || 'Login failed';
      }
    } catch (err) {
      state.error = 'An error occurred during login';
    } finally {
      state.loading = false;
    }
  });

  return (
    <div style={{
      maxWidth: '400px',
      margin: '80px auto',
      padding: '24px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>Login</h1>
      
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

      <form onSubmit$={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Username</label>
          <input
            type="text"
            value={state.username}
            onInput$={(e) => (state.username = (e.target as HTMLInputElement).value)}
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
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Password</label>
          <input
            type="password"
            value={state.password}
            onInput$={(e) => (state.password = (e.target as HTMLInputElement).value)}
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

        <button
          type="submit"
          disabled={state.loading}
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
          {state.loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
});
