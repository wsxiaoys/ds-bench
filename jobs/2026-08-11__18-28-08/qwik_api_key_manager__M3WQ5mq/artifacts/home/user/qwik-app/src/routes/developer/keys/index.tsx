import { component$, $, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z, Form, type DocumentHead } from "@builder.io/qwik-city";
import db from "~/lib/db";
import { generateApiKey, hashApiKey } from "~/lib/crypto";

export const useGetKeys = routeLoader$(async () => {
  try {
    const stmt = db.prepare(`
      SELECT id, name, key_prefix, status, created_at
      FROM api_keys
      ORDER BY id DESC
    `);
    const rows = stmt.all();
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      prefix: row.key_prefix,
      status: row.status,
      created_at: row.created_at,
    }));
  } catch (error) {
    console.error("Error loading keys:", error);
    return [];
  }
});

export const useCreateKey = routeAction$(
  async (data) => {
    const name = data.name.trim();
    const rawKey = generateApiKey();
    const prefix = rawKey.substring(0, 7);
    const hashedKey = hashApiKey(rawKey);
    const createdAt = new Date().toISOString();

    try {
      const stmt = db.prepare(`
        INSERT INTO api_keys (name, key_prefix, hashed_key, status, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(name, prefix, hashedKey, "active", createdAt);
      const id = Number(result.lastInsertRowid);

      return {
        success: true,
        id,
        name,
        prefix,
        key: rawKey,
        status: "active",
        created_at: createdAt,
      };
    } catch (error: any) {
      return {
        success: false,
        error: "Database error: " + error.message,
      };
    }
  },
  zod$({
    name: z.string().min(1, "Name is required and must not be empty"),
  })
);

export const useRevokeKey = routeAction$(
  async (data) => {
    const id = Number(data.id);
    try {
      const stmt = db.prepare("UPDATE api_keys SET status = 'revoked' WHERE id = ?");
      stmt.run(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
  zod$({
    id: z.coerce.number(),
  })
);

export default component$(() => {
  const keys = useGetKeys();
  const createAction = useCreateKey();
  const revokeAction = useRevokeKey();

  const copied = useSignal(false);
  const copyToClipboard = $(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  });

  return (
    <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div class="max-w-4xl mx-auto">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">API Key Manager</h1>
            <p class="text-sm text-gray-500 mt-1">Generate, monitor, and revoke your API keys.</p>
          </div>
          <div class="text-xs bg-blue-100 text-blue-800 font-medium px-2.5 py-0.5 rounded-full">
            Developer Console
          </div>
        </div>

        {/* Success Alert for newly generated key */}
        {createAction.value?.success && (createAction.value as any).key && (
          <div class="bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg shadow-sm mb-8 animate-fade-in">
            <div class="flex items-start">
              <div class="flex-shrink-0 mt-0.5">
                <svg class="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="ml-3 flex-1">
                <h3 class="text-base font-bold text-green-800">API Key Successfully Generated!</h3>
                <p class="text-sm text-green-700 mt-1">
                  Make sure to copy your API key now. For security reasons, <span class="font-semibold underline">you will not be able to see it again</span>.
                </p>
                <div class="mt-4 flex items-center bg-white p-3 rounded border border-green-200 shadow-inner">
                  <code class="text-sm font-mono break-all select-all text-gray-800 flex-1 font-semibold">
                    {(createAction.value as any).key}
                  </code>
                  <button
                    type="button"
                    onClick$={() => copyToClipboard((createAction.value as any).key || "")}
                    class="ml-4 bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-green-700 transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    {copied.value ? "Copied!" : "Copy Key"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {createAction.value?.success === false && (
          <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm mb-8">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">Error Generating Key</h3>
                <p class="text-xs text-red-700 mt-1">{(createAction.value as any).error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Create Key Form */}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 class="text-lg font-bold text-gray-900 mb-4">Generate New API Key</h2>
          <Form action={createAction} class="space-y-4">
            <div>
              <label for="name" class="block text-sm font-medium text-gray-700">
                Key Name / Description
              </label>
              <div class="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  placeholder="e.g. Production Frontend, Integration Test"
                  class="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={createAction.formData?.get("name") || ""}
                />
              </div>
              {(createAction.value as any)?.fieldErrors?.name && (
                <p class="mt-2 text-sm text-red-600">{(createAction.value as any).fieldErrors.name}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={createAction.isRunning}
              class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition duration-150 ease-in-out"
            >
              {createAction.isRunning ? "Generating..." : "Generate Key"}
            </button>
          </Form>
        </div>

        {/* Existing Keys Table */}
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-bold text-gray-900">Your API Keys</h2>
          </div>
          {keys.value.length === 0 ? (
            <div class="p-8 text-center text-gray-500">
              <svg class="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <p class="text-sm">No API keys generated yet. Use the form above to generate your first key.</p>
            </div>
          ) : (
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Prefix
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th scope="col" class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {keys.value.map((key: any) => (
                    <tr key={key.id} class="hover:bg-gray-50 transition duration-150 ease-in-out">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-semibold text-gray-900">{key.name}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <code class="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                          {key.prefix}
                        </code>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {key.status === "active" ? (
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(key.created_at).toLocaleString()}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {key.status === "active" ? (
                          <button
                            type="button"
                            onClick$={() => revokeAction.submit({ id: key.id })}
                            disabled={revokeAction.isRunning}
                            class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition duration-150 ease-in-out"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span class="text-xs text-gray-400 italic">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "API Key Manager - Developer Console",
  links: [
    {
      rel: "stylesheet",
      href: "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css",
    },
  ],
};
