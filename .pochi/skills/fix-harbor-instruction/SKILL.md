---
name: fix-harbor-instruction
description: |
  Fix instruction.md in a Harbor evaluation task by dropping the Acceptance Criteria section to avoid leaking test details to agents, while retaining critical formatting or output requirements. Use this when the user asks to "fix the instruction.md", "remove acceptance criteria", or "fix harbor task instructions".
---

# Fix Harbor Task Instruction

This skill guides you to fix an `instruction.md` file in a Harbor evaluation task by removing the "Acceptance Criteria" section. The goal is to prevent leaking too much information about the final tests (`tests/test_final_state.py`) to the agent, while ensuring the agent still has enough information to format its output correctly and pass the tests.

## Workflow

### Step 1: Analyze the Task Files
1. Read the `instruction.md` file in the task directory.
2. Read the `tests/test_final_state.py` file in the task directory.
3. Understand the relationship between the acceptance criteria in `instruction.md` and the assertions in `test_final_state.py`.

### Step 2: Determine What to Retain
Analyze the "Acceptance Criteria" section in `instruction.md`:
- **Drop completely:** Any criteria that have been mentioned earlier in the instruction or are not tightly related to the final tests (e.g., project paths, standard commands, basic setup steps).
- **Retain and Move:** Required information that the agent *must* know to pass the final test (e.g., specific output formats, file names, specific log messages, exact API requirements). Move these into other sections like "Implementation Hints" or the general task description.

### Step 3: Apply the Fix
Edit the `instruction.md` file to:
1. Delete the "Acceptance Criteria" header and its contents.
2. Insert any retained, required information into appropriate existing sections (like "Implementation Hints").
3. Ensure the modified `instruction.md` is clear, concise, and does not leak the exact test assertions.

## Important Notes
- This skill should only focus on fixing **one task** at a time.
- The changes to `instruction.md` MUST be based on the relationship between `instruction.md` and `test_final_state.py`.

## Examples of Fixes

Here are some examples of how to apply these fixes:

### Example 1: Dropping Acceptance Criteria Totally
If all the acceptance criteria content has been mentioned before or is not tightly related to the final tests, drop it totally.
**Tasks like:** `capacitor_preferences_multi_key_crud`, `capacitor_push_notifications_android_fcm_v1_setup`, `lancedb_embedding_pca_projection_py`.

*Diff Example (capacitor_preferences_multi_key_crud):*
```diff
- ## Acceptance Criteria
- - Project path: /home/user/myapp
- - Start command: `npm run preview -- --host 0.0.0.0 --port 4173`
- - Port: 4173
- - `npm run build` must complete without errors and produce a `dist/` directory containing `index.html`.
- - `capacitor.config.ts` (or `capacitor.config.json`) must exist at the project root with `appName` equal to `KV Admin`, `appId` equal to `com.example.kvadmin`, and `webDir` equal to `dist`.
- - `package.json` must list `@capacitor/core`, `@capacitor/cli`, and `@capacitor/preferences` as dependencies (any of `dependencies` or `devDependencies`). The installed major version of `@capacitor/preferences` must be `8`.
- - `npx cap sync` executed after the production build must exit with status 0.
- - The served page at `http://localhost:4173/` must contain elements with HTML ids `kv-key`, `kv-value`, `kv-set-btn`, `kv-remove-btn`, `kv-clear-btn`, and `kv-list`.
- - On a fresh browser session (empty `localStorage`), `#kv-list` must initially contain zero `<li>` children.
- - After entering a key in `#kv-key` and a value in `#kv-value` and clicking `#kv-set-btn`, a `<li data-key="<key>"><key>=<value></li>` element must appear inside `#kv-list`, and the value must be retrievable via `Preferences.get`.
- - Stored entries must persist across full page reloads (the list rebuilds itself from Preferences on load).
- - Clicking `#kv-remove-btn` while `#kv-key` holds a stored key must remove that key from `#kv-list` and from Preferences.
- - Clicking `#kv-clear-btn` must remove every `<li>` from `#kv-list` and clear every entry from Preferences.
```

### Example 2: Retaining Required Info
If there is required info in the acceptance criteria that needs to be mentioned so the agent can pass the final test, retain it in other sections.
**Tasks like:** `alchemyst_metadata_filter_search_ts`, `daytona_create_sandbox_ts`, `daytona_declarative_image_py`, `godot_enemy_stats_resource_spawner`, `godot_navigation_agent_2d_dynamic_obstacles`, `lancedb_query_logging_audit_table_py`.

*Diff Example (daytona_create_sandbox_ts):*
```diff
@@ -10,7 +10,7 @@ In this task you will write a small Node.js script that uses the Daytona TypeScr
 - Authenticate using the `DAYTONA_API_KEY` environment variable (already present in the environment).
 - Read `run-id` from `/logs/artifacts/run-id`.
 - Create a brand-new sandbox whose `name` is `create-sandbox-ts-${run-id}`.
-- After the sandbox is created, write its UUID to `/home/user/myproject/output.log` on a single line.
+- After the sandbox is created, write its UUID to `/home/user/myproject/output.log` on a single line with format: `Sandbox ID: <id>`.
 - After writing the log, delete the sandbox you just created so it does not consume quota.
 ## Implementation Hints
@@ -19,12 +19,3 @@ In this task you will write a small Node.js script that uses the Daytona TypeScr
 - Use `daytona.create({ name, language: 'typescript', ... })` to create the sandbox. The returned object exposes the sandbox's `id`.
 - Use `daytona.delete(sandbox)` (not `remove`) to remove the sandbox at the end.
 - Drive the script with `node`. You may use TypeScript with `tsx`/`ts-node` or plain JavaScript — both are acceptable.
-
--## Acceptance Criteria
-- - Project path: /home/user/myproject
-- - Log file: /home/user/myproject/output.log
-- - The sandbox is created on the real Daytona SaaS (`https://app.daytona.io/api`) via the `@daytonaio/sdk` TypeScript SDK.
-- - The sandbox `name` must equal `create-sandbox-ts-${run-id}`, where `run-id` is read from `/logs/artifacts/run-id`.
-- - `/home/user/myproject/output.log` must contain a single line matching the format: `Sandbox ID: <id>` where `<id>` is the UUID returned by the SDK for the created sandbox.
-- - After the script finishes, the created sandbox has been deleted via the SDK.
```

*Diff Example (daytona_declarative_image_py):*
```diff
@@ -18,14 +18,6 @@ Daytona's Declarative Builder lets you define sandbox images programmatically us
 - `sandbox.process.code_run` returns an object whose `result` attribute contains the captured stdout from the executed Python snippet; parse the printed versions and write them in the required format on the host.
 - Make sure the sandbox is deleted at the end, even if it was successfully created.
 - Do not mock the Daytona service; interact with the real Daytona SaaS.
-
--## Acceptance Criteria
-- Project path: /home/user/myproject
-- Log file: /home/user/myproject/output.log
-- - The sandbox created in Daytona must be named `decl-py-${run-id}`, where `run-id` is read from `/logs/artifacts/run-id`.
-- - The sandbox must be built from a declarative `Image` based on `debian_slim('3.12')` with `requests` and `pyyaml` installed via `pip_install`.
-- - The log file must contain exactly two lines (in any order) with the following formats:
--   - `requests: <version>` where `<version>` is the installed `requests` package version (a dotted version string such as `2.32.3`).
--   - `yaml: <version>` where `<version>` is the installed `PyYAML` runtime version reported by `yaml.__version__` (a dotted version string such as `6.0.2`).
-- - The sandbox `decl-py-${run-id}` must be deleted after the task completes.
-
+- The log file must contain exactly two lines (in any order) of the form `requests: <version>` and `yaml: <version>`.
```
