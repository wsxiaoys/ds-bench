---
name: fix-harbor-instruction
description: |
  Fix instruction.md in a Harbor evaluation task by dropping the Acceptance Criteria section to avoid leaking test details to agents, while retaining critical formatting or output requirements. Use this when the user asks to "fix the instruction.md", "remove acceptance criteria", or "fix harbor task instructions".
---

# Fix Harbor Task Instruction

This skill guides you to fix a Harbor task's `instruction.md` by removing the
"Acceptance Criteria" section so it does not leak the assertions in
`tests/test_final_state.py` to the solving agent — while still keeping any
information the agent *must* know to produce a passing output (file paths,
exact log formats, named exports, etc.).

## Workflow

1. **Read the inputs.** Open `tasks/<task>/instruction.md` and
   `tasks/<task>/tests/test_final_state.py`.
2. **Classify each bullet under `## Acceptance Criteria`.** For each line, decide:
   - **Drop** — already stated earlier in the instruction, or it merely
     restates what `test_final_state.py` checks (e.g. "the verifier will
     count children", "must contain a JSON array of strings"). Anything that
     would let the agent reverse-engineer the test belongs in this bucket.
   - **Retain** — the agent cannot pass the test without this fact, and it
     is *not* mentioned anywhere else in the instruction. Typical examples:
     a literal log-line format (`Sandbox ID: <id>`), the exact filename the
     verifier imports (`solution.py` exporting `LoggedSearcher`), the
     required output path (`/home/user/myproject/dist/main.js`).
3. **Apply the edit.**
   - Delete the entire `## Acceptance Criteria` header and its bullet list.
   - Move retained bullets into a pre-existing section such as the task
     description body or `## Implementation Hints`. Rewrite them as
     guidance ("write the UUID on a single line with format
     `Sandbox ID: <id>`") rather than as a checklist.
4. **Sanity check.** Re-read the resulting instruction. It must still be
   solvable: paths, commands, required exports, and output formats that
   appear in the tests must still be discoverable from the instruction.

## Rules

- Only fix **one task** per invocation.
- The decision to drop or retain must be justified by a corresponding line
  in `test_final_state.py`. If a criterion is checked by the tests AND its
  exact form (a literal string, a specific file path, a named symbol) is
  not stated elsewhere in the instruction → retain it.
- Never invent new information. Only rephrase what already existed in the
  acceptance criteria.
- Do not touch `tests/`, `solution/`, or any other files in the task
  directory.

## Few-Shot Examples

The nine examples below are drawn from
[PR #37](https://github.com/wsxiaoys/ds-bench/pull/37). Each linked file in
`references/examples/` inlines both the full `instruction.md` diff and the
full `tests/test_final_state.py` so you can study the exact mapping between
criteria and assertions.

### Pattern A — Drop the whole section

When every acceptance bullet is already implied by earlier text or simply
mirrors the test assertions, delete the section entirely.

**Example: `capacitor_push_notifications_android_fcm_v1_setup`** — see
[`references/examples/capacitor_push_notifications_android_fcm_v1_setup.md`](references/examples/capacitor_push_notifications_android_fcm_v1_setup.md).

```diff
-## Acceptance Criteria
-- Project path: /home/user/myproject
-- Ensure the real configuration changes are applied and the artifacts exist (do not delete the existing scaffolded files).
-- Log file: /home/user/myproject/setup.log — must exist and contain lines matching the format `OK: <change>` that mention each of `google-services`, `firebase-messaging`, `google-services.json`, and `requestPermissions` at least once.
-- `package.json` `dependencies` includes `@capacitor/push-notifications` with a version that satisfies `^8` (semver major 8).
-- `android/build.gradle` contains a classpath entry for `com.google.gms:google-services:4.4.2`.
-- `android/app/build.gradle` applies the `com.google.gms.google-services` plugin **and** declares an `implementation` dependency on `com.google.firebase:firebase-messaging`.
-- `android/app/google-services.json` exists, parses as valid JSON, and the JSON contains a client whose `client_info.android_client_info.package_name` equals `com.example.myapp`.
-- `src/push.ts` exists and:
-  - imports `PushNotifications` from `@capacitor/push-notifications`,
-  - exports a function named `initPush`,
-  - registers listeners for the four event names listed above (string literals must appear in the file),
-  - calls `requestPermissions()` before `register()`,
-  - only calls `register()` inside a code path guarded by a check that the permission `receive` value is `'granted'`.
-
```

Every line above either appears earlier in the task body (project path,
start command, port, the `kv-*` element ids inside the "Task" section) or
restates what `tests/test_final_state.py` does (count `<li>` children,
trigger clicks, assert `Preferences.get`).

Other tasks that match this pattern (full inline diff + test in each file):

- [`capacitor_push_notifications_android_fcm_v1_setup`](references/examples/capacitor_push_notifications_android_fcm_v1_setup.md)
- [`lancedb_embedding_pca_projection_py`](references/examples/lancedb_embedding_pca_projection_py.md)
- [`godot_navigation_agent_2d_dynamic_obstacles`](references/examples/godot_navigation_agent_2d_dynamic_obstacles.md)

### Pattern B — Drop the section, but retain one or two bullets

Most criteria still go, but one or two bullets convey information the agent
cannot infer (log path, exact log-line format, the verifier's import line).
Move those into an existing section before deleting the header.

**Example: `daytona_create_sandbox_ts`** — see
[`references/examples/daytona_create_sandbox_ts.md`](references/examples/daytona_create_sandbox_ts.md).

```diff
@@ -10,7 +10,7 @@ In this task you will write a small Node.js script that uses the Daytona TypeScr
 - Authenticate using the `DAYTONA_API_KEY` environment variable (already present in the environment).
 - Read `run-id` from `/logs/artifacts/run-id`.
 - Create a brand-new sandbox whose `name` is `create-sandbox-ts-${run-id}`.
-- After the sandbox is created, write its UUID to `/home/user/myproject/output.log` on a single line.
+- After the sandbox is created, write its UUID to `/home/user/myproject/output.log` on a single line with format: `Sandbox ID: <id>`.
 - After writing the log, delete the sandbox you just created so it does not consume quota.

@@ -19,12 +19,3 @@ In this task you will write a small Node.js script that uses the Daytona TypeScr
 - Use `daytona.create({ name, language: 'typescript', ... })` to create the sandbox. The returned object exposes the sandbox's `id`.
 - Use `daytona.delete(sandbox)` (not `remove`) to remove the sandbox at the end.
 - Drive the script with `node`. You may use TypeScript with `tsx`/`ts-node` or plain JavaScript — both are acceptable.
-
-## Acceptance Criteria
-- Project path: /home/user/myproject
-- Log file: /home/user/myproject/output.log
-- The sandbox is created on the real Daytona SaaS (`https://app.daytona.io/api`) via the `@daytonaio/sdk` TypeScript SDK.
-- The sandbox `name` must equal `create-sandbox-ts-${run-id}`, where `run-id` is read from `/logs/artifacts/run-id`.
-- `/home/user/myproject/output.log` must contain a single line matching the format: `Sandbox ID: <id>` where `<id>` is the UUID returned by the SDK for the created sandbox.
-- After the script finishes, the created sandbox has been deleted via the SDK.
```

Why retain only the format string? `test_final_state.py` does:

```python
SANDBOX_ID_REGEX = re.compile(r"^Sandbox ID:\s*(?P<id>[A-Za-z0-9-]+)\s*$", re.MULTILINE)
```

If the agent does not see `Sandbox ID: <id>` somewhere in the instruction
it cannot produce a passing log. Everything else (project path, SaaS URL,
sandbox name, deletion) is already in the body or "Implementation Hints",
so it is dropped. The format requirement is folded into the existing body
bullet about writing the UUID.

**Example: `daytona_declarative_image_py`** — see
[`references/examples/daytona_declarative_image_py.md`](references/examples/daytona_declarative_image_py.md).

```diff
@@ -18,14 +18,6 @@ Daytona's Declarative Builder lets you define sandbox images programmatically us
 - `sandbox.process.code_run` returns an object whose `result` attribute contains the captured stdout from the executed Python snippet; parse the printed versions and write them in the required format on the host.
 - Make sure the sandbox is deleted at the end, even if it was successfully created.
 - Do not mock the Daytona service; interact with the real Daytona SaaS.
-
-## Acceptance Criteria
 - Project path: /home/user/myproject
 - Log file: /home/user/myproject/output.log
-- The sandbox created in Daytona must be named `decl-py-${run-id}`, where `run-id` is read from `/logs/artifacts/run-id`.
-- The sandbox must be built from a declarative `Image` based on `debian_slim('3.12')` with `requests` and `pyyaml` installed via `pip_install`.
-- The log file must contain exactly two lines (in any order) with the following formats:
-  - `requests: <version>` where `<version>` is the installed `requests` package version (a dotted version string such as `2.32.3`).
-  - `yaml: <version>` where `<version>` is the installed `PyYAML` runtime version reported by `yaml.__version__` (a dotted version string such as `6.0.2`).
-- The sandbox `decl-py-${run-id}` must be deleted after the task completes.
-
+- The log file must contain exactly two lines (in any order) of the form `requests: <version>` and `yaml: <version>`.
```

The retained "project path", "log file", and "two lines of the form …"
bullets are reattached to the *Implementation Hints* section. The two
log-line formats are kept because `test_final_state.py` does literal
regex matching on `requests:` and `yaml:` lines and the formats appear
nowhere else.

Other tasks that match this pattern:

- [`alchemyst_metadata_filter_search_ts`](references/examples/alchemyst_metadata_filter_search_ts.md) — retain `dist/main.js` build path (tested explicitly).
- [`godot_enemy_stats_resource_spawner`](references/examples/godot_enemy_stats_resource_spawner.md) — retain the "Required files" sub-list of `.gd`/`.tscn` paths and field signatures.
- [`lancedb_query_logging_audit_table_py`](references/examples/lancedb_query_logging_audit_table_py.md) — retain the `solution.py` export path and the `LoggedSearcher` class contract.

## Index of inlined examples

Each file below contains the full diff applied to `instruction.md` *and*
the full `tests/test_final_state.py` so you can audit the
criterion-to-assertion mapping yourself:

- [`alchemyst_metadata_filter_search_ts`](references/examples/alchemyst_metadata_filter_search_ts.md)
- [`capacitor_preferences_multi_key_crud`](references/examples/capacitor_preferences_multi_key_crud.md)
- [`capacitor_push_notifications_android_fcm_v1_setup`](references/examples/capacitor_push_notifications_android_fcm_v1_setup.md)
- [`daytona_create_sandbox_ts`](references/examples/daytona_create_sandbox_ts.md)
- [`daytona_declarative_image_py`](references/examples/daytona_declarative_image_py.md)
- [`godot_enemy_stats_resource_spawner`](references/examples/godot_enemy_stats_resource_spawner.md)
- [`godot_navigation_agent_2d_dynamic_obstacles`](references/examples/godot_navigation_agent_2d_dynamic_obstacles.md)
- [`lancedb_embedding_pca_projection_py`](references/examples/lancedb_embedding_pca_projection_py.md)
- [`lancedb_query_logging_audit_table_py`](references/examples/lancedb_query_logging_audit_table_py.md)
