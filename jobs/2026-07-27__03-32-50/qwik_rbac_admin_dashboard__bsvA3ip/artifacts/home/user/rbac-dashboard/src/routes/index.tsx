import { $, component$, useSignal } from '@builder.io/qwik';
import { type DocumentHead, routeLoader$, useNavigate } from '@builder.io/qwik-city';
import type { SessionUser } from '~/lib/auth';
import { listContent, type ContentRow } from '~/lib/db';

export const useDashboardData = routeLoader$((requestEvent) => {
  const user = requestEvent.sharedMap.get('user') as SessionUser | null;
  const content = listContent();
  return { user, content };
});

export default component$(() => {
  const data = useDashboardData();
  const nav = useNavigate();

  const items = useSignal<ContentRow[]>(data.value.content);
  const title = useSignal('');
  const body = useSignal('');
  const error = useSignal('');

  const user = data.value.user;
  const canEdit = user?.role === 'editor' || user?.role === 'admin';

  const refresh = $(async () => {
    const res = await fetch('/api/content');
    if (res.ok) {
      items.value = await res.json();
    }
  });

  const addContent = $(async () => {
    error.value = '';
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.value, body: body.value }),
    });

    if (res.ok) {
      title.value = '';
      body.value = '';
      await refresh();
    } else {
      const data2 = await res.json().catch(() => ({}));
      error.value = typeof data2.error === 'string' ? data2.error : 'Failed to add content';
    }
  });

  const removeContent = $(async (id: number) => {
    const res = await fetch(`/api/content/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refresh();
    }
  });

  const logout = $(async () => {
    await fetch('/api/logout', { method: 'POST' });
    await nav('/login');
  });

  return (
    <div class="dashboard">
      <h1>RBAC Dashboard</h1>

      {user ? (
        <div class="session-bar">
          <p>
            Signed in as <strong>{user.username}</strong> ({user.role})
          </p>
          {user.role === 'admin' && <a href="/admin">Go to Admin</a>}
          <button onClick$={logout}>Log out</button>
        </div>
      ) : (
        <p>
          <a href="/login">Log in</a>
        </p>
      )}

      <h2>Content</h2>
      <ul>
        {items.value.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong>: {item.body}{' '}
            {canEdit && <button onClick$={() => removeContent(item.id)}>Delete</button>}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div>
          <h3>Add Content</h3>
          <form preventdefault:submit onSubmit$={addContent}>
            <input
              placeholder="Title"
              value={title.value}
              onInput$={(_, el) => (title.value = el.value)}
            />
            <input
              placeholder="Body"
              value={body.value}
              onInput$={(_, el) => (body.value = el.value)}
            />
            <button type="submit">Add</button>
          </form>
          {error.value && (
            <p role="alert" class="error">
              {error.value}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: 'RBAC Dashboard',
};
