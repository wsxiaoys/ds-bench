import { $, component$, useSignal } from '@builder.io/qwik';
import { type DocumentHead, useNavigate } from '@builder.io/qwik-city';

export default component$(() => {
  const username = useSignal('');
  const password = useSignal('');
  const error = useSignal('');
  const submitting = useSignal(false);
  const nav = useNavigate();

  const submit = $(async () => {
    error.value = '';
    submitting.value = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.value, password: password.value }),
      });

      if (res.ok) {
        await nav('/');
        return;
      }

      const data = await res.json().catch(() => ({}));
      error.value = typeof data.error === 'string' ? data.error : 'Login failed';
    } finally {
      submitting.value = false;
    }
  });

  return (
    <div class="login-page">
      <h1>Login</h1>
      <form preventdefault:submit onSubmit$={submit}>
        <div>
          <label for="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autocomplete="username"
            value={username.value}
            onInput$={(_, el) => (username.value = el.value)}
          />
        </div>
        <div>
          <label for="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autocomplete="current-password"
            value={password.value}
            onInput$={(_, el) => (password.value = el.value)}
          />
        </div>
        <button type="submit" disabled={submitting.value}>
          Log in
        </button>
      </form>
      {error.value && (
        <p role="alert" class="error">
          {error.value}
        </p>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Login - RBAC Dashboard',
};
