import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { type DocumentHead, routeLoader$ } from '@builder.io/qwik-city';
import type { SessionUser } from '~/lib/auth';

/**
 * Server-side guard for the admin page.
 *
 * - Not authenticated  -> redirect (3xx) to /login
 * - Authenticated, but not `admin` -> 403
 * - `admin` -> allowed through, current user is returned to the component
 */
export const useAdminGuard = routeLoader$((requestEvent) => {
  const user = requestEvent.sharedMap.get('user') as SessionUser | null;

  if (!user) {
    throw requestEvent.redirect(302, '/login');
  }

  if (user.role !== 'admin') {
    throw requestEvent.error(403, 'Forbidden: admin role required');
  }

  return user;
});

interface PublicUser {
  id: number;
  username: string;
  role: string;
}

const UsersPanel = component$(() => {
  const users = useSignal<PublicUser[]>([]);
  const username = useSignal('');
  const password = useSignal('');
  const role = useSignal('viewer');
  const message = useSignal('');
  const loading = useSignal(false);

  const load = $(async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      users.value = await res.json();
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    load();
  });

  const createUser = $(async () => {
    message.value = '';
    loading.value = true;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.value,
          password: password.value,
          role: role.value,
        }),
      });

      if (res.ok) {
        username.value = '';
        password.value = '';
        role.value = 'viewer';
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        message.value = typeof data.error === 'string' ? data.error : 'Failed to create user';
      }
    } finally {
      loading.value = false;
    }
  });

  return (
    <div>
      <h2>Users</h2>
      <ul>
        {users.value.map((u) => (
          <li key={u.id}>
            <strong>{u.username}</strong> — {u.role}
          </li>
        ))}
      </ul>

      <h3>Add User</h3>
      <form preventdefault:submit onSubmit$={createUser}>
        <div>
          <label for="new-username">Username</label>
          <input
            id="new-username"
            value={username.value}
            onInput$={(_, el) => (username.value = el.value)}
          />
        </div>
        <div>
          <label for="new-password">Password</label>
          <input
            id="new-password"
            type="password"
            value={password.value}
            onInput$={(_, el) => (password.value = el.value)}
          />
        </div>
        <div>
          <label for="new-role">Role</label>
          <select id="new-role" value={role.value} onChange$={(_, el) => (role.value = el.value)}>
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button type="submit" disabled={loading.value}>
          Create User
        </button>
      </form>
      {message.value && (
        <p role="alert" class="error">
          {message.value}
        </p>
      )}
    </div>
  );
});

export default component$(() => {
  const admin = useAdminGuard();

  return (
    <div class="admin-page">
      <h1>User Management</h1>
      <p>
        Signed in as {admin.value.username} ({admin.value.role})
      </p>
      <UsersPanel />
    </div>
  );
});

export const head: DocumentHead = {
  title: 'User Management - RBAC Dashboard',
};
