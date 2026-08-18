import { component$, useSignal, $ } from '@builder.io/qwik';
import { Form, routeAction$, routeLoader$ } from '@builder.io/qwik-city';
import db from '../../../lib/db';
import { generateApiKey, hashKey } from '../../../lib/keys';

export const useGetKeys = routeLoader$(async () => {
  try {
    const stmt = db.prepare(`
      SELECT id, name, key_prefix AS prefix, status, created_at
      FROM api_keys
      ORDER BY id DESC
    `);
    return stmt.all() as Array<{
      id: number;
      name: string;
      prefix: string;
      status: string;
      created_at: string;
    }>;
  } catch (err) {
    console.error('Error loading keys:', err);
    return [];
  }
});

export const useCreateKey = routeAction$(async (data) => {
  const name = data.name;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return { error: 'Name is required' };
  }

  try {
    const trimmedName = name.trim();
    const plainTextKey = generateApiKey();
    const prefix = plainTextKey.substring(0, 7);
    const hashed = hashKey(plainTextKey);
    const status = 'active';
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO api_keys (name, key_prefix, hashed_key, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(trimmedName, prefix, hashed, status, createdAt);
    const id = Number(result.lastInsertRowid);

    return {
      success: true,
      id,
      name: trimmedName,
      prefix,
      key: plainTextKey,
      status,
      created_at: createdAt
    };
  } catch (err: any) {
    console.error('Error creating key:', err);
    return { error: 'Failed to create API key' };
  }
});

export const useRevokeKey = routeAction$(async (data) => {
  const id = Number(data.id);
  if (isNaN(id)) {
    return { error: 'Invalid key ID' };
  }

  try {
    const stmt = db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes === 0) {
      return { error: 'Key not found' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error revoking key:', err);
    return { error: 'Failed to revoke API key' };
  }
});

export default component$(() => {
  const keysSignal = useGetKeys();
  const createAction = useCreateKey();
  const revokeAction = useRevokeKey();

  const copiedSignal = useSignal(false);

  const copyToClipboard = $((text: string) => {
    navigator.clipboard.writeText(text);
    copiedSignal.value = true;
    setTimeout(() => {
      copiedSignal.value = false;
    }, 2000);
  });

  return (
    <main>
      <header style={{ marginBottom: '2rem', padding: '1rem 0', borderBottom: '1px solid var(--border-color)', background: 'transparent' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>API Key Manager</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Generate, monitor, and revoke developer API keys securely.</p>
      </header>

      {/* Success Alert Box for Generated Key - shown exactly once */}
      {createAction.value?.success && createAction.value.key && (
        <div class="alert-success">
          <h3>🎉 API Key Generated Successfully!</h3>
          <p style={{ margin: '0 0 1rem 0' }}>
            Please copy your API key now. For security reasons, <strong>you will not be able to see it again</strong>.
          </p>
          <div class="key-display">
            <span class="key-code">{createAction.value.key}</span>
            <button
              type="button"
              class="btn btn-primary"
              onClick$={() => copyToClipboard(createAction.value?.key || '')}
            >
              {copiedSignal.value ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Error displays */}
      {createAction.value?.error && (
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <strong>Error:</strong> {createAction.value.error}
        </div>
      )}

      {revokeAction.value?.error && (
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
          <strong>Error:</strong> {revokeAction.value.error}
        </div>
      )}

      <div class="card">
        <h2>Generate New Key</h2>
        <Form action={createAction}>
          <div class="form-group">
            <label for="key-name">Key Name / Description</label>
            <input
              type="text"
              id="key-name"
              name="name"
              placeholder="e.g., Production Frontend, Testing Client"
              class="input-control"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary" disabled={createAction.isRunning}>
            {createAction.isRunning ? 'Generating...' : 'Generate API Key'}
          </button>
        </Form>
      </div>

      <div class="card">
        <h2>Existing API Keys</h2>
        {keysSignal.value.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
            No API keys found. Generate one above to get started.
          </p>
        ) : (
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keysSignal.value.map((key) => (
                  <tr key={key.id}>
                    <td style={{ fontWeight: 500 }}>{key.name}</td>
                    <td class="text-mono">{key.prefix}</td>
                    <td>
                      <span class={`badge ${key.status === 'active' ? 'badge-active' : 'badge-revoked'}`}>
                        {key.status}
                      </span>
                    </td>
                    <td>{new Date(key.created_at).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      {key.status === 'active' ? (
                        <Form action={revokeAction}>
                          <input type="hidden" name="id" value={key.id} />
                          <button
                            type="submit"
                            class="btn btn-danger btn-sm"
                            disabled={revokeAction.isRunning}
                          >
                            {revokeAction.isRunning ? 'Revoking...' : 'Revoke'}
                          </button>
                        </Form>
                      ) : (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Revoked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
});
