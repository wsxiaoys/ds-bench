import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form } from "@builder.io/qwik-city";
import { db, generateApiKey } from "~/lib/db";

export const useApiKeys = routeLoader$(() => {
  const stmt = db.prepare(`
    SELECT id, name, key_prefix AS prefix, status, created_at
    FROM api_keys
    ORDER BY id DESC
  `);
  return stmt.all() as { id: number; name: string; prefix: string; status: "active" | "revoked"; created_at: string }[];
});

export const useGenerateKey = routeAction$(async (data, { fail }) => {
  const name = data.name;
  if (!name || typeof name !== "string" || name.trim() === "") {
    return fail(400, { message: "Name is required and must be a non-empty string" });
  }

  const { key, prefix, hashedKey } = generateApiKey();
  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO api_keys (name, key_prefix, hashed_key, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(name.trim(), prefix, hashedKey, "active", createdAt);
  const id = Number(result.lastInsertRowid);

  return {
    success: true,
    id,
    name: name.trim(),
    prefix,
    key,
    status: "active",
    created_at: createdAt,
  };
});

export const useRevokeKey = routeAction$(async (data, { fail }) => {
  const id = Number(data.id);
  if (isNaN(id)) {
    return fail(400, { message: "Invalid key ID" });
  }

  const checkStmt = db.prepare("SELECT id FROM api_keys WHERE id = ?");
  const row = checkStmt.get(id);
  if (!row) {
    return fail(404, { message: "Key not found" });
  }

  const updateStmt = db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?");
  updateStmt.run(id);

  return { success: true };
});

export default component$(() => {
  const keys = useApiKeys();
  const generateAction = useGenerateKey();
  const revokeAction = useRevokeKey();

  return (
    <div class="container">
      <header>
        <h1>API Key Manager</h1>
      </header>

      {/* Show newly generated key exactly once in a prominent alert box */}
      {generateAction.value?.success && generateAction.value.key && (
        <div class="alert alert-success">
          <div class="alert-title">🎉 Key Generated Successfully!</div>
          <p>
            Please copy your new API key now. For security reasons, <strong>we cannot show it to you again.</strong>
          </p>
          <div class="api-key-display">{generateAction.value.key}</div>
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Name: <strong>{generateAction.value.name}</strong> | Prefix: <span class="mono">{generateAction.value.prefix}</span>
          </p>
        </div>
      )}

      {/* Show validation errors if generation fails */}
      {generateAction.value?.failed && (
        <div class="alert alert-danger">
          <div class="alert-title">Error</div>
          <p>{generateAction.value.message || "Failed to generate key."}</p>
        </div>
      )}

      <div class="card">
        <h2>Generate New API Key</h2>
        <Form action={generateAction}>
          <div class="form-group">
            <label for="key-name">Key Name / Description</label>
            <input
              type="text"
              id="key-name"
              name="name"
              placeholder="e.g. Production Frontend, Mobile App"
              required
            />
          </div>
          <button type="submit" class="btn-primary" disabled={generateAction.isRunning}>
            {generateAction.isRunning ? "Generating..." : "Generate API Key"}
          </button>
        </Form>
      </div>

      <div class="card">
        <h2>Your API Keys</h2>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.value.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    No API keys found. Create one above!
                  </td>
                </tr>
              ) : (
                keys.value.map((key) => (
                  <tr key={key.id}>
                    <td><strong>{key.name}</strong></td>
                    <td><span class="mono">{key.prefix}</span></td>
                    <td>
                      <span class={`badge ${key.status === "active" ? "badge-active" : "badge-revoked"}`}>
                        {key.status}
                      </span>
                    </td>
                    <td>{new Date(key.created_at).toLocaleString()}</td>
                    <td>
                      {key.status === "active" ? (
                        <Form action={revokeAction}>
                          <input type="hidden" name="id" value={key.id} />
                          <button
                            type="submit"
                            class="btn-danger"
                            disabled={revokeAction.isRunning}
                          >
                            {revokeAction.isRunning ? "Revoking..." : "Revoke"}
                          </button>
                        </Form>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
